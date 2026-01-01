import { useState } from 'react';
import { Pipette } from 'lucide-react';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  label?: string;
}

export default function ColorPicker({ color, onChange, label }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customColor, setCustomColor] = useState(color);

  const presetColors = [
    '#000000', '#1A1A1A', '#333333', '#555555', '#777777', '#999999', '#BBBBBB', '#EEEEEE', '#FFFFFF',
    '#FF0000', '#FF5722', '#FF9800', '#FFC107', '#FFEB3B',
    '#8BC34A', '#4CAF50', '#009688', '#00BCD4', '#03A9F4',
    '#2196F3', '#3F51B5', '#673AB7', '#9C27B0', '#E91E63',
  ];

  const handleColorSelect = (selectedColor: string) => {
    onChange(selectedColor);
    setCustomColor(selectedColor);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {label && <span className="text-[#777777] text-xs">{label}</span>}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.08)] transition-colors"
        >
          <div
            className="w-5 h-5 rounded border border-[rgba(255,255,255,0.2)]"
            style={{ backgroundColor: color }}
          />
          <Pipette size={12} className="text-[#777777]" />
        </button>
      </div>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[250]"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-2 z-[300] glass-surface p-4 rounded-lg shadow-xl min-w-[240px]">
            <div className="mb-3">
              <label className="text-[#777777] text-xs mb-2 block">Preset Colors</label>
              <div className="grid grid-cols-9 gap-1.5">
                {presetColors.map((presetColor) => (
                  <button
                    key={presetColor}
                    onClick={() => handleColorSelect(presetColor)}
                    className="w-6 h-6 rounded border border-[rgba(255,255,255,0.2)] hover:scale-110 transition-transform"
                    style={{ backgroundColor: presetColor }}
                    title={presetColor}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="text-[#777777] text-xs mb-2 block">Custom Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="w-12 h-8 rounded border border-[rgba(255,255,255,0.2)] bg-transparent cursor-pointer"
                />
                <input
                  type="text"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="flex-1 form-input text-xs"
                  placeholder="#000000"
                />
                <button
                  onClick={() => handleColorSelect(customColor)}
                  className="btn-muted text-xs px-3"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
