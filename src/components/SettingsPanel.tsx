// src/components/SettingsPanel.tsx

import React from "react";
import { Sliders, Camera, Eye, MapPin } from "lucide-react";

export interface SettingsState {
  horizonThreshold: number;
  bortleScale: number;
  focalLength: number;
  cropFactor: number;
}

interface SettingsPanelProps {
  settings: SettingsState;
  onChange: (settings: SettingsState) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onChange,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const handleBortleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...settings, bortleScale: Number(e.target.value) });
  };

  const handleHorizonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...settings, horizonThreshold: Number(e.target.value) });
  };

  const handleFocalLengthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...settings, focalLength: Number(e.target.value) });
  };

  const handleCropFactorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...settings, cropFactor: Number(e.target.value) });
  };

  const getBortleDescription = (scale: number): string => {
    switch (scale) {
      case 1:
        return "Bortle 1: Excellent truly dark site. Zodiacal light is bright; airglow is readily visible.";
      case 2:
        return "Bortle 2: Typical truly dark site. Milky Way core highly structured; stars cast shadows.";
      case 3:
        return "Bortle 3: Rural sky. Milky Way has complex detail; minor light pollution domes on horizon.";
      case 4:
        return "Bortle 4: Rural/suburban transition. Zodiacal light is faint; light domes visible in many directions.";
      case 5:
        return "Bortle 5: Suburban sky. Milky Way is weak/washed out near horizon; light sources visible.";
      case 6:
        return "Bortle 6: Bright suburban sky. Milky Way is visible only near zenith; sky is gray.";
      case 7:
        return "Bortle 7: Suburban/urban transition. Milky Way is invisible or extremely faint.";
      case 8:
        return "Bortle 8: City sky. No Milky Way visible; constellations are difficult to identify.";
      case 9:
        return "Bortle 9: Inner-city sky. The sky is brightly lit; only bright stars are visible.";
      default:
        return "";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm">
      <div 
        className="h-full w-full max-w-md bg-[#161B22] border-l border-gray-800 p-6 flex flex-col justify-between shadow-2xl text-[#F0F4F8]"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-[#9D4EDD]">
              <Sliders size={20} /> Settings & Calibration
            </h2>
            <button 
              onClick={onClose} 
              className="text-gray-400 hover:text-white transition-colors text-sm font-semibold border border-gray-800 rounded px-2.5 py-1"
            >
              Close
            </button>
          </div>

          <div className="space-y-6">
            {/* 1. Bortle Scale Adjustment */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                <MapPin size={16} className="text-[#9D4EDD]" />
                Bortle Light Pollution Scale: <span className="text-white font-bold">{settings.bortleScale}</span>
              </label>
              <input
                type="range"
                min="1"
                max="9"
                step="1"
                value={settings.bortleScale}
                onChange={handleBortleChange}
                className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-[#9D4EDD]"
              />
              <p className="text-xs text-[#8B949E] bg-black/30 p-2.5 rounded border border-gray-800/50 leading-relaxed min-h-[50px]">
                {getBortleDescription(settings.bortleScale)}
              </p>
            </div>

            {/* 2. Horizon Obstruction Threshold */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                <Eye size={16} className="text-[#9D4EDD]" />
                Horizon Obstruction Limit: <span className="text-white font-bold">{settings.horizonThreshold}°</span>
              </label>
              <input
                type="range"
                min="0"
                max="45"
                step="5"
                value={settings.horizonThreshold}
                onChange={handleHorizonChange}
                className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-[#9D4EDD]"
              />
              <p className="text-xs text-[#8B949E] leading-relaxed">
                Core visibility threshold. Increase if standing in canyons, valleys, or dense forests where coordinates below {settings.horizonThreshold}° are blocked.
              </p>
            </div>

            {/* 3. Camera Lens Configuration */}
            <div className="border-t border-gray-800 pt-6 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2 mb-2">
                <Camera size={16} className="text-[#9D4EDD]" /> Camera Calibration
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-gray-400">Focal Length (mm)</label>
                  <select
                    value={settings.focalLength}
                    onChange={handleFocalLengthChange}
                    className="w-full bg-black/40 border border-gray-800 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-[#9D4EDD]"
                  >
                    <option value="12">12mm (Ultra-wide)</option>
                    <option value="14">14mm (Standard Astro)</option>
                    <option value="16">16mm</option>
                    <option value="18">18mm</option>
                    <option value="20">20mm</option>
                    <option value="24">24mm (Fast prime)</option>
                    <option value="35">35mm</option>
                    <option value="50">50mm (Nifty fifty)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-400">Sensor Crop Factor</label>
                  <select
                    value={settings.cropFactor}
                    onChange={handleCropFactorChange}
                    className="w-full bg-black/40 border border-gray-800 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-[#9D4EDD]"
                  >
                    <option value="1.0">1.0x Full Frame</option>
                    <option value="1.5">1.5x APS-C (Nikon/Sony)</option>
                    <option value="1.6">1.6x APS-C (Canon)</option>
                    <option value="2.0">2.0x Micro Four Thirds</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-[#8B949E] leading-relaxed">
                Used to calculate maximum exposure duration to avoid star trails using the <strong>500 Rule</strong>:
                <br />
                <code className="text-white bg-black/30 px-1 py-0.5 rounded inline-block mt-1">
                  Exposure = 500 / (Focal Length × Crop Factor)
                </code>
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 pt-4 mt-6">
          <p className="text-center text-[10px] text-gray-500">
            SeleneGalactica Calibrator © 2026. Computations are processed client-side.
          </p>
        </div>
      </div>
    </div>
  );
};
