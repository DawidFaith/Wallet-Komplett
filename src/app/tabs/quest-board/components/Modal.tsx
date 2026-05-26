'use client';

import React from 'react';
import { FaTimes } from 'react-icons/fa';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
  if (!open) return null;

  const handleBackdropPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm pt-8"
      onPointerDown={handleBackdropPointerDown}
    >
      <div className="bg-zinc-900 rounded-2xl w-full max-w-lg mx-4 max-h-[88vh] overflow-y-auto border border-zinc-700 shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-zinc-700 sticky top-0 bg-zinc-900 z-10">
          <h3 className="font-bold text-lg text-red-400 truncate pr-4">{title}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1 transition-colors">
            <FaTimes size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
