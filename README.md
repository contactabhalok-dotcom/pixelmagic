# PixelMagic - AI Image Editor Suite

A modern, AI-powered web tool for image editing with 4 core features:
- **BG Remover** - Clean background removal with AI edge detection
- **Image Cropper** - Mobile-style smooth cropping with aspect ratios
- **Image Resizer** - Pixel-perfect resizing with multiple modes
- **Image Upscaler** - 2x/4x/8x super resolution

## Features

- Modern glassmorphism UI design
- Drag & drop file upload
- Live preview
- Mobile responsive
- Smooth animations

## Project Structure

```
pixelmagic/
├── backend/
│   ├── main.py           # FastAPI server
│   ├── requirements.txt  # Python dependencies
│   ├── uploads/          # Temporary uploads
│   └── processed/        # Processed images
├── frontend/
│   ├── index.html        # Home page
│   ├── bg-remover.html   # Background remover
│   ├── cropper.html      # Crop tool
│   ├── resize.html       # Resize tool
│   ├── upscale.html      # Upscale tool
│   └── assets/
│       ├── css/
│       │   └── style.css # Main stylesheet
│       └── js/
│           ├── utils.js      # Utility functions
│           ├── upload.js     # Upload handler
│           ├── bgremove.js   # BG remover logic
│           ├── crop.js       # Crop tool logic
│           ├── resize.js     # Resize tool logic
│           └── upscale.js    # Upscale tool logic
└── README.md
```

## Setup & Installation

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment (recommended):
   ```bash
   python -m venv venv

   # Windows
   venv\Scripts\activate

   # macOS/Linux
   source venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Run the server:
   ```bash
   python main.py
   ```

   Or with uvicorn:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

The API will be available at `http://localhost:8000`

### Frontend Setup

1. Open the frontend in a web browser. You can use any local server:

   Using Python:
   ```bash
   cd frontend
   python -m http.server 5500
   ```

   Using Node.js (http-server):
   ```bash
   npx http-server frontend -p 5500
   ```

   Or use VS Code Live Server extension.

2. Open `http://localhost:5500` in your browser

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/upload` | POST | Upload an image |
| `/remove-bg` | POST | Remove background |
| `/crop` | POST | Crop image |
| `/resize` | POST | Resize image |
| `/upscale` | POST | Upscale image |
| `/download/{filename}` | GET | Download file |

## Configuration

### API Base URL
Update the `API_BASE` constant in `frontend/assets/js/utils.js` if your backend is running on a different URL:

```javascript
const API_BASE = 'http://localhost:8000';
```

### File Limits
- Maximum file size: 10MB
- Supported formats: JPG, PNG, WebP
- Maximum output dimension: 10000px

## Technologies Used

### Frontend
- HTML5, CSS3, JavaScript (ES6+)
- Custom CSS with glassmorphism design
- Google Fonts (Poppins, Inter)

### Backend
- Python 3.8+
- FastAPI
- Pillow (image processing)
- rembg (background removal)
- APScheduler (file cleanup)

## License

MIT License
