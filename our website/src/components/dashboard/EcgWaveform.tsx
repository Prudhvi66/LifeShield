import React, { useEffect, useRef } from 'react';

interface EcgWaveformProps {
  heartRate: number;
  isAbnormal?: boolean;
}

export const EcgWaveform: React.FC<EcgWaveformProps> = ({ heartRate, isAbnormal = false }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const points: number[] = [];
    const width = canvas.width;
    const height = canvas.height;
    const midY = height / 2;

    // ECG pattern generator
    let beatTimer = 0;
    const speed = Math.max(1.5, heartRate / 45);

    const render = () => {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.2)'; // fade trail
      ctx.fillRect(0, 0, width, height);

      beatTimer += speed;
      let y = midY;

      const beatPeriod = 100;
      const beatPos = beatTimer % beatPeriod;

      // P-Q-R-S-T wave calculation
      if (beatPos > 20 && beatPos < 30) {
        // P-wave
        y = midY - Math.sin(((beatPos - 20) / 10) * Math.PI) * 6;
      } else if (beatPos >= 35 && beatPos <= 38) {
        // Q-dip
        y = midY + 4;
      } else if (beatPos > 38 && beatPos < 44) {
        // R-peak (sharp upward spike)
        y = midY - (isAbnormal ? 36 : 28);
      } else if (beatPos >= 44 && beatPos <= 48) {
        // S-dip (sharp downward drop)
        y = midY + 12;
      } else if (beatPos > 56 && beatPos < 74) {
        // T-wave
        y = midY - Math.sin(((beatPos - 56) / 18) * Math.PI) * 9;
      } else {
        // Isoelectric baseline with tiny micro-noise
        y = midY + (Math.random() - 0.5) * 1.5;
      }

      points.push(y);
      if (points.length > width) {
        points.shift();
      }

      ctx.beginPath();
      ctx.strokeStyle = isAbnormal ? '#ef4444' : '#38bdf8';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 6;
      ctx.shadowColor = isAbnormal ? '#ef4444' : '#38bdf8';

      for (let i = 0; i < points.length; i++) {
        if (i === 0) ctx.moveTo(i, points[i]);
        else ctx.lineTo(i, points[i]);
      }
      ctx.stroke();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [heartRate, isAbnormal]);

  return (
    <canvas
      ref={canvasRef}
      width={220}
      height={50}
      className="w-full h-12 rounded-lg bg-slate-950/70 border border-slate-800"
    />
  );
};
