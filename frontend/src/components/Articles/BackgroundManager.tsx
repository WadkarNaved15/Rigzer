import { Plus, Trash2, Image as ImageIcon } from 'lucide-react';
import ColorPicker from './ColorPicker';
import ImageUpload from './ImageUpload';

export interface BackgroundSection {
  id: string;
  type: 'color' | 'image';
  value: string;
  file?: File;    
  startPosition: number;
  endPosition: number;
}

interface BackgroundManagerProps {
  sections: BackgroundSection[];
  onChange: (sections: BackgroundSection[]) => void;
}

export default function BackgroundManager({ sections, onChange }: BackgroundManagerProps) {
  const addSection = () => {
    const lastSection = sections[sections.length - 1];
    const startPos = lastSection ? lastSection.endPosition : 0;

    const newSection: BackgroundSection = {
      id: crypto.randomUUID(),
      type: 'color',
      value: '#1A1A1A',
      startPosition: startPos,
      endPosition: startPos + 1000,
    };

    onChange([...sections, newSection]);
  };

  const updateSection = (id: string, updates: Partial<BackgroundSection>) => {
    const sectionIndex = sections.findIndex(s => s.id === id);
    if (sectionIndex === -1) return;

    const updatedSections = [...sections];
    updatedSections[sectionIndex] = { ...updatedSections[sectionIndex], ...updates };

    // If endPosition changed, cascade to subsequent sections
    if (updates.endPosition !== undefined) {
      for (let i = sectionIndex + 1; i < updatedSections.length; i++) {
        const prevEnd = updatedSections[i - 1].endPosition;
        const currentHeight = updatedSections[i].endPosition - updatedSections[i].startPosition;
        updatedSections[i] = {
          ...updatedSections[i],
          startPosition: prevEnd,
          endPosition: prevEnd + currentHeight,
        };
      }
    }

    // If startPosition changed, cascade to subsequent sections
    if (updates.startPosition !== undefined) {
      const heightBefore = sections[sectionIndex].endPosition - sections[sectionIndex].startPosition;
      updatedSections[sectionIndex].endPosition = updates.startPosition + heightBefore;

      for (let i = sectionIndex + 1; i < updatedSections.length; i++) {
        const prevEnd = updatedSections[i - 1].endPosition;
        const currentHeight = updatedSections[i].endPosition - updatedSections[i].startPosition;
        updatedSections[i] = {
          ...updatedSections[i],
          startPosition: prevEnd,
          endPosition: prevEnd + currentHeight,
        };
      }
    }

    onChange(updatedSections);
  };

  const deleteSection = (id: string) => {
    const sectionIndex = sections.findIndex(s => s.id === id);
    if (sectionIndex === -1) return;

    const filtered = sections.filter((section) => section.id !== id);

    // Cascade positions for sections after the deleted one
    const updatedSections = filtered.map((section, index) => {
      if (index <= sectionIndex) return section;

      const prevEnd = filtered[index - 1].endPosition;
      const currentHeight = section.endPosition - section.startPosition;
      return {
        ...section,
        startPosition: prevEnd,
        endPosition: prevEnd + currentHeight,
      };
    });

    onChange(updatedSections);
  };

  return (
    <div className="sidebar-panel">
      <div className="flex items-center justify-between mb-3">
        <h4>Background Sections</h4>
        <button
          onClick={addSection}
          className="text-[#666666] hover:text-[#999999] transition-colors"
        >
          <Plus size={12} />
        </button>
      </div>

      <div className="space-y-3">
        {sections.length === 0 ? (
          <p className="text-[#444444] text-xs">No background sections</p>
        ) : (
          sections.map((section, index) => (
            <div
              key={section.id}
              className="bg-[rgba(255,255,255,0.02)] rounded-lg p-3 space-y-2"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[#777777] text-xs">Section {index + 1}</span>
                <button
                  onClick={() => deleteSection(section.id)}
                  className="text-[#444444] hover:text-red-400 transition-colors"
                >
                  <Trash2 size={10} />
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (section.type !== 'color') {
                        updateSection(section.id, { type: 'color', value: '#1A1A1A' });
                      }
                    }}
                    className={`flex-1 px-2 py-1.5 rounded text-xs transition-colors ${section.type === 'color'
                      ? 'bg-[rgba(255,255,255,0.12)] text-[#EEEEEE]'
                      : 'bg-[rgba(255,255,255,0.04)] text-[#666666] hover:bg-[rgba(255,255,255,0.08)]'
                      }`}
                  >
                    Color
                  </button>
                  <button
                    onClick={() => {
                      if (section.type !== 'image') {
                        updateSection(section.id, { type: 'image', value: '' });
                      }
                    }}
                    className={`flex-1 px-2 py-1.5 rounded text-xs transition-colors ${section.type === 'image'
                      ? 'bg-[rgba(255,255,255,0.12)] text-[#EEEEEE]'
                      : 'bg-[rgba(255,255,255,0.04)] text-[#666666] hover:bg-[rgba(255,255,255,0.08)]'
                      }`}
                  >
                    <ImageIcon size={10} className="inline mr-1" />
                    Image
                  </button>
                </div>

                {section.type === 'color' ? (
                  <ColorPicker
                    color={section.value}
                    onChange={(color) => updateSection(section.id, { value: color })}
                  />
                ) : (
                  <div className="space-y-2">
                    <input
                      type="url"
                      value={section.value}
                      onChange={(e) => updateSection(section.id, { value: e.target.value })}
                      className="w-full form-input text-xs"
                      placeholder="Paste image URL"
                    />
                    <div className="text-center text-[#555555] text-[10px]">or</div>
                    <ImageUpload
                      type="image"
                      onSelect={(file, previewUrl) => {
                        updateSection(section.id, {
                          file,
                          value: previewUrl, // store preview URL as background image
                        });
                      }}
                    />

                  </div>
                )}

                <div className="space-y-2">
                  <div>
                    <label className="text-[#555555] text-[10px] block mb-1">
                      Height (px)
                    </label>
                    <input
                      type="number"
                      value={section.endPosition - section.startPosition}
                      onChange={(e) => {
                        const height = parseInt(e.target.value) || 100;
                        updateSection(section.id, {
                          endPosition: section.startPosition + height,
                        });
                      }}
                      className="w-full form-input text-xs"
                      min="100"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[#555555] text-[10px] block mb-1">
                        Start (px)
                      </label>
                      <input
                        type="number"
                        value={section.startPosition}
                        onChange={(e) =>
                          updateSection(section.id, {
                            startPosition: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full form-input text-xs"
                        disabled={index > 0}
                        title={index > 0 ? 'Auto-set from previous section' : ''}
                      />
                    </div>
                    <div>
                      <label className="text-[#555555] text-[10px] block mb-1">
                        End (px)
                      </label>
                      <input
                        type="number"
                        value={section.endPosition}
                        onChange={(e) =>
                          updateSection(section.id, {
                            endPosition: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full form-input text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
