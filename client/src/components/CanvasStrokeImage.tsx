import React, { useEffect, useState } from 'react';
import { Image as KonvaImage } from 'react-konva';
import type { CanvasStroke } from '../types/canvas';
import api from '../api/client';

interface CanvasStrokeImageProps {
  stroke: CanvasStroke;
  draggable?: boolean;
}

export const CanvasStrokeImage: React.FC<CanvasStrokeImageProps> = ({ stroke, draggable = false }) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    const loadImage = (src: string) => {
      const nextImage = new window.Image();
      nextImage.onload = () => {
        if (!cancelled) setImage(nextImage);
      };
      nextImage.src = src;
    };
    if (stroke.imageAssetId) {
      api.get<Blob>(`/canvas/assets/${stroke.imageAssetId}`, { responseType: 'blob' }).then(({ data }) => {
        objectUrl = URL.createObjectURL(data);
        if (!cancelled) loadImage(objectUrl);
      }).catch(() => setImage(null));
    } else if (stroke.imageUrl) {
      loadImage(stroke.imageUrl);
    }

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [stroke.imageAssetId, stroke.imageUrl]);

  return image ? (
    <KonvaImage
      image={image}
      x={stroke.x || 0}
      y={stroke.y || 0}
      width={stroke.width || 300}
      height={stroke.height || 200}
      draggable={draggable}
    />
  ) : null;
};
