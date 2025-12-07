"""
PixelMagic Backend - FastAPI Server
AI-powered image editing suite
"""

from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os
import uuid
import shutil
from datetime import datetime, timedelta
from PIL import Image
import io
from typing import Optional
from apscheduler.schedulers.background import BackgroundScheduler

# Scheduler instance
scheduler = BackgroundScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    scheduler.start()
    yield
    # Shutdown
    scheduler.shutdown()

# Initialize FastAPI app
app = FastAPI(
    title="PixelMagic API",
    description="AI Image Editor Suite Backend",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directory setup
UPLOAD_DIR = "uploads"
PROCESSED_DIR = "processed"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)

# Mount static files
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
app.mount("/processed", StaticFiles(directory=PROCESSED_DIR), name="processed")


def cleanup_old_files():
    """Delete files older than 30 minutes"""
    threshold = datetime.now() - timedelta(minutes=30)
    for directory in [UPLOAD_DIR, PROCESSED_DIR]:
        for filename in os.listdir(directory):
            filepath = os.path.join(directory, filename)
            if os.path.isfile(filepath):
                file_time = datetime.fromtimestamp(os.path.getmtime(filepath))
                if file_time < threshold:
                    os.remove(filepath)


# Schedule cleanup every 15 minutes
scheduler.add_job(cleanup_old_files, 'interval', minutes=15)


def validate_image(file: UploadFile) -> bool:
    """Validate uploaded file"""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPG, PNG, WEBP allowed.")
    return True


def generate_filename(original_name: str) -> str:
    """Generate unique filename"""
    ext = os.path.splitext(original_name)[1]
    return f"{uuid.uuid4().hex}{ext}"


@app.get("/")
async def root():
    return {"message": "PixelMagic API is running", "version": "1.0.0"}


@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    """Upload an image file"""
    try:
        validate_image(file)

        # Check file size
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large. Max 10MB allowed.")

        # Save file
        filename = generate_filename(file.filename)
        filepath = os.path.join(UPLOAD_DIR, filename)

        with open(filepath, "wb") as f:
            f.write(content)

        # Get image dimensions
        img = Image.open(io.BytesIO(content))
        width, height = img.size

        return {
            "status": "success",
            "filename": filename,
            "imageUrl": f"/uploads/{filename}",
            "width": width,
            "height": height
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/remove-bg")
async def remove_background(
    filename: str = Form(...),
    softness: int = Form(0),
    feather: int = Form(0)
):
    """Remove background from image with improved edge quality"""
    try:
        from rembg import remove, new_session
        from PIL import ImageFilter, ImageOps
        import numpy as np

        input_path = os.path.join(UPLOAD_DIR, filename)
        if not os.path.exists(input_path):
            raise HTTPException(status_code=404, detail="Image not found")

        # Process image with rembg using u2net model for better quality
        with open(input_path, "rb") as f:
            input_data = f.read()

        # Use alpha matting for better edge quality
        output_data = remove(
            input_data,
            alpha_matting=True,
            alpha_matting_foreground_threshold=240,
            alpha_matting_background_threshold=10,
            alpha_matting_erode_size=10
        )

        output_img = Image.open(io.BytesIO(output_data))

        # Ensure RGBA mode
        if output_img.mode != 'RGBA':
            output_img = output_img.convert('RGBA')

        # Get alpha channel for processing
        r, g, b, a = output_img.split()

        # Convert alpha to numpy for processing
        alpha_array = np.array(a, dtype=np.float32)

        # Clean up alpha channel - remove noise and improve edges
        # Threshold to clean up semi-transparent areas that should be opaque
        alpha_array = np.where(alpha_array > 200, 255, alpha_array)
        alpha_array = np.where(alpha_array < 30, 0, alpha_array)

        # Convert back to PIL
        a = Image.fromarray(alpha_array.astype(np.uint8))

        # Apply softness if requested (smooth the alpha edges)
        if softness > 0:
            # Apply multiple passes of slight blur for smoother transitions
            blur_radius = softness * 0.3
            a = a.filter(ImageFilter.GaussianBlur(radius=blur_radius))

        # Apply feather if requested (expand soft edges outward)
        if feather > 0:
            # Feathering creates a gradual fade at edges
            feather_radius = feather * 0.5
            a = a.filter(ImageFilter.GaussianBlur(radius=feather_radius))
            # Expand the feathered area slightly
            a = a.filter(ImageFilter.MaxFilter(3))
            a = a.filter(ImageFilter.GaussianBlur(radius=feather_radius * 0.5))

        # Merge back
        output_img = Image.merge('RGBA', (r, g, b, a))

        # Save processed image with high quality
        output_filename = f"bg_removed_{uuid.uuid4().hex}.png"
        output_path = os.path.join(PROCESSED_DIR, output_filename)
        output_img.save(output_path, "PNG", optimize=True)

        return {
            "status": "success",
            "imageUrl": f"/processed/{output_filename}",
            "filename": output_filename
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


@app.post("/crop")
async def crop_image(
    filename: str = Form(...),
    x: int = Form(...),
    y: int = Form(...),
    width: int = Form(...),
    height: int = Form(...)
):
    """Crop image to specified dimensions"""
    try:
        input_path = os.path.join(UPLOAD_DIR, filename)
        if not os.path.exists(input_path):
            raise HTTPException(status_code=404, detail="Image not found")

        img = Image.open(input_path)

        # Validate crop bounds
        img_width, img_height = img.size
        if x < 0 or y < 0 or x + width > img_width or y + height > img_height:
            raise HTTPException(status_code=400, detail="Invalid crop dimensions")

        # Crop image
        cropped = img.crop((x, y, x + width, y + height))

        # Save processed image
        output_filename = f"cropped_{uuid.uuid4().hex}.png"
        output_path = os.path.join(PROCESSED_DIR, output_filename)
        cropped.save(output_path, "PNG")

        return {
            "status": "success",
            "imageUrl": f"/processed/{output_filename}",
            "filename": output_filename,
            "width": width,
            "height": height
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Crop failed: {str(e)}")


@app.post("/resize")
async def resize_image(
    filename: str = Form(...),
    width: int = Form(...),
    height: int = Form(...),
    mode: str = Form("fit"),
    format: str = Form("png"),
    quality: int = Form(90)
):
    """Resize image to specified dimensions"""
    try:
        input_path = os.path.join(UPLOAD_DIR, filename)
        if not os.path.exists(input_path):
            raise HTTPException(status_code=404, detail="Image not found")

        img = Image.open(input_path)
        original_width, original_height = img.size

        if mode == "fit":
            # Maintain aspect ratio, fit within bounds
            img.thumbnail((width, height), Image.Resampling.LANCZOS)
            resized = img
        elif mode == "fill":
            # Maintain aspect ratio, fill bounds (crop excess)
            ratio = max(width / original_width, height / original_height)
            new_size = (int(original_width * ratio), int(original_height * ratio))
            img = img.resize(new_size, Image.Resampling.LANCZOS)

            # Center crop
            left = (img.width - width) // 2
            top = (img.height - height) // 2
            resized = img.crop((left, top, left + width, top + height))
        else:  # stretch
            resized = img.resize((width, height), Image.Resampling.LANCZOS)

        # Save processed image
        ext = "png" if format == "png" else "jpg"
        output_filename = f"resized_{uuid.uuid4().hex}.{ext}"
        output_path = os.path.join(PROCESSED_DIR, output_filename)

        if format == "jpg":
            if resized.mode == 'RGBA':
                resized = resized.convert('RGB')
            resized.save(output_path, "JPEG", quality=quality)
        else:
            resized.save(output_path, "PNG")

        return {
            "status": "success",
            "imageUrl": f"/processed/{output_filename}",
            "filename": output_filename,
            "width": resized.width,
            "height": resized.height
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Resize failed: {str(e)}")


@app.post("/upscale")
async def upscale_image(
    filename: str = Form(...),
    scale: int = Form(2)
):
    """Upscale image with enhanced quality using LANCZOS interpolation and sharpening"""
    try:
        from PIL import ImageFilter, ImageEnhance
        import numpy as np

        input_path = os.path.join(UPLOAD_DIR, filename)
        if not os.path.exists(input_path):
            raise HTTPException(status_code=404, detail="Image not found")

        if scale not in [2, 4, 8]:
            raise HTTPException(status_code=400, detail="Scale must be 2, 4, or 8")

        img = Image.open(input_path)
        original_width, original_height = img.size

        new_width = original_width * scale
        new_height = original_height * scale

        # Preserve alpha channel if present
        has_alpha = img.mode == 'RGBA'
        alpha = None
        if has_alpha:
            alpha = img.split()[3]
            alpha = alpha.resize((new_width, new_height), Image.Resampling.LANCZOS)

        # Convert to RGB for processing
        if img.mode != 'RGB':
            img = img.convert('RGB')

        # Step 1: Upscale using high-quality LANCZOS
        upscaled = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

        # Step 2: Apply sharpening to enhance details
        enhancer = ImageEnhance.Sharpness(upscaled)
        upscaled = enhancer.enhance(1.3)  # Moderate sharpening

        # Step 3: Apply unsharp mask for edge enhancement
        try:
            blurred = upscaled.filter(ImageFilter.GaussianBlur(radius=1))
            np_upscaled = np.array(upscaled, dtype=np.float32)
            np_blurred = np.array(blurred, dtype=np.float32)

            # Unsharp mask: original + amount * (original - blurred)
            amount = 0.4
            np_sharpened = np_upscaled + amount * (np_upscaled - np_blurred)
            np_sharpened = np.clip(np_sharpened, 0, 255).astype(np.uint8)
            upscaled = Image.fromarray(np_sharpened)
        except Exception:
            # If unsharp mask fails, continue with just the sharpened image
            pass

        # Step 4: Subtle contrast boost
        enhancer = ImageEnhance.Contrast(upscaled)
        upscaled = enhancer.enhance(1.05)

        # Restore alpha channel if it existed
        if has_alpha and alpha is not None:
            upscaled = upscaled.convert('RGBA')
            upscaled.putalpha(alpha)

        # Save processed image
        output_filename = f"upscaled_{scale}x_{uuid.uuid4().hex}.png"
        output_path = os.path.join(PROCESSED_DIR, output_filename)
        upscaled.save(output_path, "PNG")

        return {
            "status": "success",
            "imageUrl": f"/processed/{output_filename}",
            "filename": output_filename,
            "width": new_width,
            "height": new_height,
            "scale": scale
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upscale failed: {str(e)}")


@app.get("/download/{filename}")
async def download_file(filename: str):
    """Download processed file"""
    # Check in processed directory first
    filepath = os.path.join(PROCESSED_DIR, filename)
    if not os.path.exists(filepath):
        filepath = os.path.join(UPLOAD_DIR, filename)

    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        filepath,
        media_type="application/octet-stream",
        filename=filename
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
