import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, CheckCircle2 } from 'lucide-react';
import { beepSound } from '../lib/utils';

export const ScanModal: React.FC = () => {
  const {
    scanModalOpen,
    closeScanModal,
    scanCallback,
    processInvoiceBarcode,
    currentPage
  } = useApp();

  const [lastCode, setLastCode] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lockedCodeRef = useRef<string | null>(null);
  const missStreakRef = useRef(0);

  useEffect(() => {
    if (!scanModalOpen) return;

    lockedCodeRef.current = null;
    missStreakRef.current = 0;
    setLastCode(null);

    const html5Qr = new Html5Qrcode('camera-reader-element');
    scannerRef.current = html5Qr;

    html5Qr
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 150 } },
        (decodedText: string) => {
          missStreakRef.current = 0;
          if (decodedText === lockedCodeRef.current) return;

          lockedCodeRef.current = decodedText;
          setLastCode(decodedText);
          beepSound();

          if (scanCallback) {
            scanCallback(decodedText);
          } else if (currentPage === 'saleInvoice') {
            processInvoiceBarcode(decodedText, 'camera');
          }
        },
        () => {
          missStreakRef.current++;
          if (missStreakRef.current >= 6 && lockedCodeRef.current !== null) {
            lockedCodeRef.current = null;
          }
        }
      )
      .catch(err => {
        console.error('Camera scan error:', err);
      });

    return () => {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch(() => {})
          .finally(() => {
            scannerRef.current = null;
          });
      }
    };
  }, [scanModalOpen]);

  if (!scanModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1F2A3C]/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={closeScanModal}
    >
      <div
        className="bg-[#FFFDF8] border border-[#D8CBB0] rounded-2xl w-full max-w-md p-5 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#D8CBB0]">
          <h3 className="font-serif font-bold text-base md:text-lg text-[#1F2A3C] flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#A9762F]" />
            مسح الباركود بالكاميرا
          </h3>
          <button
            onClick={closeScanModal}
            className="p-1 rounded-lg hover:bg-black/5 text-[#8E98A6] hover:text-[#1F2A3C] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-[#8E98A6] mt-2 mb-3 leading-relaxed">
          وجّه الكاميرا على الباركود — يتم التقاطه تلقائياً دون تكرار حتى تبعد الكود وترجعه مرة أخرى.
        </p>

        {/* Video Container */}
        <div className="overflow-hidden rounded-xl bg-black border border-[#D8CBB0]/40 aspect-video relative">
          <div id="camera-reader-element" className="w-full h-full" />
        </div>

        {/* Detected Code Banner */}
        <div className="mt-4 p-3 rounded-xl bg-[#FAF6EE] border border-[#D8CBB0] text-center">
          {lastCode ? (
            <div className="text-[#5C7A5E] font-bold flex items-center justify-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              تم المسح: <span className="font-mono text-base">{lastCode}</span>
            </div>
          ) : (
            <span className="text-xs text-[#8E98A6]">في انتظار توجيه الكاميرا على الباركود...</span>
          )}
        </div>

        <button
          onClick={closeScanModal}
          className="w-full mt-4 py-2.5 rounded-xl bg-[#A8503A] hover:bg-[#8e4130] text-white font-bold text-sm transition-colors"
        >
          إغلاق
        </button>
      </div>
    </div>
  );
};
