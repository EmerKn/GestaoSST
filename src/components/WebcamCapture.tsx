import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, X, RefreshCw, Check } from 'lucide-react';

interface WebcamCaptureProps {
  onCapture: (dataUrl: string) => void;
  onCancel: () => void;
}

export function WebcamCapture({ onCapture, onCancel }: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (err) {
      console.error("Error accessing webcam:", err);
      setError("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []); // Only run once on mount

  const capture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Calculate a square crop from the center
      const size = Math.min(video.videoWidth, video.videoHeight);
      const startX = (video.videoWidth - size) / 2;
      const startY = (video.videoHeight - size) / 2;
      
      canvas.width = size;
      canvas.height = size;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw the cropped square
        ctx.drawImage(video, startX, startY, size, size, 0, 0, size, size);
        
        // Resize to a reasonable avatar size (e.g., 400x400)
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = 400;
        finalCanvas.height = 400;
        const finalCtx = finalCanvas.getContext('2d');
        if (finalCtx) {
          finalCtx.drawImage(canvas, 0, 0, 400, 400);
          const dataUrl = finalCanvas.toDataURL('image/jpeg', 0.8);
          setCapturedImage(dataUrl);
        }
      }
    }
  };

  const retake = () => {
    setCapturedImage(null);
  };

  const confirm = () => {
    if (capturedImage) {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      onCapture(capturedImage);
    }
  };

  const handleCancel = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    onCancel();
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl overflow-hidden max-w-md w-full shadow-2xl">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Tirar Foto (Webcam)
          </h3>
          <button onClick={handleCancel} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="bg-black relative flex justify-center items-center min-h-[350px] overflow-hidden">
          {error ? (
            <div className="text-white text-center p-6">
              <p className="text-red-400 mb-4">{error}</p>
              <button 
                onClick={startCamera}
                className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-200 transition"
              >
                Tentar Novamente
              </button>
            </div>
          ) : capturedImage ? (
            <img src={capturedImage} alt="Captured" className="w-full h-[350px] object-cover" />
          ) : (
            <div className="relative w-full h-[350px] flex items-center justify-center">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="absolute min-w-full min-h-full object-cover"
                style={{ transform: 'scaleX(-1)' }} // Mirror effect for webcam
              />
              {/* Overlay to show the square crop area */}
              <div className="absolute inset-0 pointer-events-none border-[40px] border-black/50"></div>
              <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-white/50 m-[40px]"></div>
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="p-4 bg-gray-50 flex justify-center gap-4">
          {capturedImage ? (
            <>
              <button 
                onClick={retake}
                className="flex-1 py-3 px-4 bg-gray-200 text-gray-800 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-gray-300 transition"
              >
                <RefreshCw className="w-5 h-5" />
                Tirar Outra
              </button>
              <button 
                onClick={confirm}
                className="flex-1 py-3 px-4 bg-emerald-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-emerald-700 transition"
              >
                <Check className="w-5 h-5" />
                Confirmar
              </button>
            </>
          ) : (
            <button 
              onClick={capture}
              disabled={!!error}
              className="w-16 h-16 rounded-full bg-emerald-600 border-4 border-emerald-200 flex items-center justify-center text-white hover:bg-emerald-700 transition disabled:opacity-50"
            >
              <Camera className="w-8 h-8" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
