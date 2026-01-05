import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Save, Image as ImageIcon, Video as VideoIcon, Quote, Type, AlignLeft, Eye, Palette } from 'lucide-react';
import DraggableElement, { ElementPosition, ElementSize } from '../components/Articles/DraggableElement';
import AlignmentGuides from '../components/Articles/AlignmentGuides';
import BackgroundManager, { BackgroundSection } from '../components/Articles/BackgroundManager';
import ColorPicker from '../components/Articles/ColorPicker';
import ImageUpload from '../components/Articles/ImageUpload';
import { toast } from "react-toastify";
interface ContentBlock {
  id: string;
  type: 'paragraph' | 'heading' | 'image' | 'video' | 'blockquote' | 'title' | 'subtitle';
  content: string;
  metadata?: { alt?: string; duration?: string };
  position: ElementPosition;
  size?: ElementSize;
  colors?: {
    text?: string;
    background?: string;
  };
  file?: File;
}

interface Profile {
  name: string;
  role: string;
}

interface Link {
  title: string;
  url: string;
  type: string;
}

interface ThemeColors {
  background: string;
  text: string;
  primary: string;
  secondary: string;
  accent: string;
}

interface FormData {
  heroImageFile?: File; // 👈 add this
  title: string;
  subtitle: string;
  hero_image_url: string;
  category: string;
  publisher_name: string;
  genre: string;
  rating: string;
  author_name: string;
  author_role: string;
  content: ContentBlock[];
  profiles: Profile[];
  links: Link[];
  status: 'draft' | 'published';
  background_sections: BackgroundSection[];
  theme_colors: ThemeColors;
}

export default function PublisherForm({ onPreview }: { onPreview: (data: FormData) => void }) {
  const [formData, setFormData] = useState<FormData>({
    title: '',
    subtitle: '',
    hero_image_url: '',
    category: 'Review',
    publisher_name: '',
    genre: '',
    rating: '',
    author_name: '',
    author_role: '',
    content: [],
    profiles: [],
    links: [],
    status: 'draft',
    background_sections: [
      {
        id: crypto.randomUUID(),
        type: 'color',
        value: '#1A1A1A',
        startPosition: 0,
        endPosition: 10000,
      },
    ],
    theme_colors: {
      background: '#1A1A1A',
      text: '#BBBBBB',
      primary: '#EEEEEE',
      secondary: '#777777',
      accent: '#999999',
    },
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [alignmentX, setAlignmentX] = useState(-1);
  const [alignmentY, setAlignmentY] = useState(-1);
  const [scrollY, setScrollY] = useState(0);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  const isArticleInfoIncomplete = () => {
    return (
      !formData.author_name ||
      !formData.hero_image_url
    );
  };


  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollY(container.scrollTop);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const updateField = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };
  const getMediaCategory = (file: File): "image" | "video" => {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    throw new Error("Unsupported file type");
  };

  const addContentBlock = (type: ContentBlock['type']) => {
    const currentScrollY = containerRef.current?.scrollTop || 0;
    const toolbarWidth = 280;
    const sidebarWidth = 336;
    const spacing = 32;
    const totalReservedWidth = toolbarWidth + sidebarWidth + (spacing * 2);
    const availableWidth = window.innerWidth - totalReservedWidth;
    const canvasWidth = Math.min(availableWidth, 1400);

    const canvasCenter = {
      x: (canvasWidth / 2) - 200,
      y: currentScrollY + 200,
    };

    const newBlock: ContentBlock = {
      id: crypto.randomUUID(),
      type,
      content: '',
      metadata: type === 'image' ? { alt: '' } : type === 'video' ? { duration: '' } : undefined,
      position: canvasCenter,
      size: type === 'image' || type === 'video' ? { width: 400, height: 300 } : undefined,
      colors: {
        text: formData.theme_colors.text,
        background: 'transparent',
      },
    };
    updateField('content', [...formData.content, newBlock]);
  };

  const updateContentBlock = (id: string, updates: Partial<ContentBlock>) => {
    updateField(
      'content',
      formData.content.map((block) => (block.id === id ? { ...block, ...updates } : block))
    );
  };

  const deleteContentBlock = (id: string) => {
    updateField(
      'content',
      formData.content.filter((block) => block.id !== id)
    );
  };

  const handleAlignmentChange = (x: number, y: number) => {
    setAlignmentX(x);
    setAlignmentY(y);
  };

  const addProfile = () => {
    updateField('profiles', [...formData.profiles, { name: '', role: '' }]);
  };

  const updateProfile = (index: number, field: keyof Profile, value: string) => {
    const updated = [...formData.profiles];
    updated[index] = { ...updated[index], [field]: value };
    updateField('profiles', updated);
  };

  const deleteProfile = (index: number) => {
    updateField('profiles', formData.profiles.filter((_, i) => i !== index));
  };

  const addLink = () => {
    updateField('links', [...formData.links, { title: '', url: '', type: 'external' }]);
  };

  const updateLink = (index: number, field: keyof Link, value: string) => {
    const updated = [...formData.links];
    updated[index] = { ...updated[index], [field]: value };
    updateField('links', updated);
  };

  const deleteLink = (index: number) => {
    updateField('links', formData.links.filter((_, i) => i !== index));
  };

  const renderBackgroundSections = () => {
    return formData.background_sections.map((section, index) => {
      const height = section.endPosition - section.startPosition;
      const isLastSection = index === formData.background_sections.length - 1;
      const nextSection = !isLastSection ? formData.background_sections[index + 1] : null;

      const blendHeight = 200;

      if (section.type === 'color') {
        if (nextSection) {
          if (nextSection.type === 'color') {
            return (
              <div
                key={section.id}
                className="absolute w-full z-0"
                style={{
                  top: `${section.startPosition}px`,
                  height: `${height}px`,
                  background: `linear-gradient(to bottom, ${section.value} 0%, ${section.value} calc(100% - ${blendHeight}px), ${nextSection.value} 100%)`
                }}
              />
            );
          } else {
            const extendedHeight = height + blendHeight;
            return (
              <div
                key={section.id}
                className="absolute w-full z-0"
                style={{
                  top: `${section.startPosition}px`,
                  height: `${extendedHeight}px`,
                  background: `linear-gradient(to bottom, ${section.value} 0%, ${section.value} calc(100% - ${blendHeight}px), transparent 100%)`
                }}
              />
            );
          }
        } else {
          return (
            <div
              key={section.id}
              className="absolute w-full z-0"
              style={{
                top: `${section.startPosition}px`,
                height: `${height}px`,
                background: section.value
              }}
            />
          );
        }
      } else {
        const backgroundStyle: React.CSSProperties = {
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        };

        if (section.value) {
          backgroundStyle.backgroundImage = `url(${section.value})`;
        } else {
          backgroundStyle.backgroundColor = '#0F0F0F';
        }

        if (nextSection) {
          const maskGradient = `linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) calc(100% - ${blendHeight}px), rgba(0,0,0,0) 100%)`;
          backgroundStyle.maskImage = maskGradient;
          backgroundStyle.WebkitMaskImage = maskGradient;
        }

        return (
          <div
            key={section.id}
            className="absolute w-full z-0"
            style={{
              top: `${section.startPosition}px`,
              height: `${height}px`,
              ...backgroundStyle
            }}
          />
        );
      }
    });
  };

  const handleSave = async (publish: boolean) => {
    setSaving(true);
    setMessage(null);

    try {
      const postData = {
        ...formData,
        status: publish ? 'published' : 'draft',
        published_at: publish ? new Date().toISOString() : null,
        rating: formData.rating ? parseFloat(formData.rating) : null,
      };

      const blob = new Blob([JSON.stringify(postData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${formData.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setMessage({
        type: 'success',
        text: publish ? 'Post downloaded successfully!' : 'Draft downloaded successfully!',
      });

      setTimeout(() => {
        setMessage(null);
      }, 2000);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save post',
      });
    } finally {
      setSaving(false);
    }
  };
  const uploadMediaToS3 = async (
    asset: File,
    // category: "image" | "video",
    onProgress: (percent: number) => void
  ): Promise<string> => {
    // 1️⃣ Get presigned URL
    const category = getMediaCategory(asset);
    const res = await fetch(`${BACKEND_URL}/api/upload/presigned-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        fileName: asset.name,
        fileType: asset.type,
        category,
      }),
    });

    if (!res.ok) throw new Error("Failed to get presigned URL");

    const { uploadUrl, fileUrl } = await res.json();

    // 2️⃣ Upload to S3 with progress
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl, true);
      xhr.setRequestHeader("Content-Type", asset.type);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = () => (xhr.status === 200 ? resolve() : reject(new Error(`Upload failed with status ${xhr.status}`)));
      xhr.onerror = () => reject(new Error("Upload network error"));

      xhr.send(asset);
    });

    return fileUrl; // Return CloudFront URL
  };

  const handlePublish = async () => {
    try {
      setSaving(true);

      const updatedContent = await Promise.all(
        formData.content.map(async (block, index) => {
          if (block.type === "image" || block.type === "video") {
            const asset = block.file; // actual file from input
            if (!asset) return block;

            const toastId = toast.loading(`Uploading ${asset.name}... 0%`);

            const fileUrl = await uploadMediaToS3(asset, (progress) => {
              toast.update(toastId, {
                render: `Uploading ${asset.name}... ${progress}%`,
                isLoading: true,
              });
            });

            toast.update(toastId, {
              render: `${asset.name} uploaded!`,
              type: "success",
              isLoading: false,
              autoClose: 1200,
            });

            return { ...block, content: fileUrl };
          }
          return block;
        })
      );

      // Replace content in formData with uploaded URLs
      const finalCanvas = { ...formData, content: updatedContent };

      // 3️⃣ Save canvas
      const res = await fetch(`${BACKEND_URL}/api/article/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(finalCanvas),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to publish canvas");
      }

      const savedCanvas = await res.json();
      toast.success("Canvas published successfully!");
      console.log("Published canvas:", savedCanvas);

      // Optional: redirect to canvas view
      // navigate(`/canvas/${savedCanvas._id}`);
    } catch (error: any) {
      console.error("Publish error:", error);
      toast.error(error.message || "Failed to publish canvas");
    } finally {
      setSaving(false);
    }
  };
  const handlePublishClick = () => {
    if (!formData.title) return;

    if (isArticleInfoIncomplete()) {
      setShowPublishConfirm(true);
      return;
    }

    handlePublish(); // direct publish
  };


  const renderContentBlock = (block: ContentBlock) => {
    const blockStyle = {
      color: block.colors?.text || formData.theme_colors.text,
      background: block.colors?.background || 'transparent',
    };

    switch (block.type) {
      case 'paragraph':
        return (
          <div className="p-3 rounded" style={blockStyle}>
            <textarea
              value={block.content}
              onChange={(e) => updateContentBlock(block.id, { content: e.target.value })}
              className="w-full bg-transparent border-none outline-none resize-none min-h-[100px] text-base leading-relaxed"
              placeholder="Write your paragraph..."
              style={{ color: blockStyle.color }}
            />
          </div>
        );

      case 'heading':
        return (
          <div className="p-3 rounded" style={blockStyle}>
            <input
              type="text"
              value={block.content}
              onChange={(e) => updateContentBlock(block.id, { content: e.target.value })}
              className="w-full bg-transparent border-none outline-none text-2xl font-medium"
              placeholder="Heading..."
              style={{ color: blockStyle.color }}
            />
          </div>
        );

      case 'image':
        return (
          <div className="w-full h-full pointer-events-none" style={blockStyle}>
            {block.content ? (
              <img
                src={block.content}
                alt={block.metadata?.alt || ''}
                className="w-full h-full object-cover rounded pointer-events-none select-none"
                draggable={false}
              />
            ) : (
              <div className="w-full h-full bg-[#0F0F0F] rounded flex flex-col items-center justify-center gap-3 p-4 pointer-events-auto">
                <ImageIcon size={32} className="text-[#444444]" />
                <input
                  type="url"
                  value={block.content}
                  onChange={(e) => updateContentBlock(block.id, { content: e.target.value })}
                  className="w-full form-input text-sm text-center"
                  placeholder="Paste image URL"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="text-[#666666] text-xs">or</div>
                <ImageUpload
                  type="image"
                  onSelect={(file, previewUrl) =>
                    updateContentBlock(block.id, {
                      file,
                      content: previewUrl, // preview only
                    })
                  }
                />

              </div>
            )}
          </div>
        );

      case 'video':
        return (
          <div className="w-full h-full relative pointer-events-none" style={blockStyle}>
            {block.content ? (
              <>
                <video
                  src={block.content}
                  autoPlay
                  className="w-full h-full object-cover rounded opacity-75 pointer-events-none select-none"
                  draggable={false}
                />
                <div className="absolute bottom-3 left-3 text-xs bg-black/70 px-2 py-1 rounded pointer-events-none">
                  {block.metadata?.duration || '0:00'}
                </div>
              </>
            ) : (
              <div className="w-full h-full bg-[#0F0F0F] rounded flex flex-col items-center justify-center gap-3 p-4 pointer-events-auto">
                <VideoIcon size={32} className="text-[#444444]" />
                <input
                  type="url"
                  value={block.content}
                  onChange={(e) => updateContentBlock(block.id, { content: e.target.value })}
                  className="w-full form-input text-sm text-center"
                  placeholder="Paste thumbnail URL"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="text-[#666666] text-xs">or</div>
                <ImageUpload
                  type="video"
                  onSelect={(file, previewUrl) =>
                    updateContentBlock(block.id, {
                      file,
                      content: previewUrl, // preview only
                    })
                  }
                />

              </div>
            )}
          </div>
        );

      case 'blockquote':
        return (
          <div className="p-4 border-l-4 rounded" style={{ ...blockStyle, borderColor: formData.theme_colors.accent }}>
            <textarea
              value={block.content}
              onChange={(e) => updateContentBlock(block.id, { content: e.target.value })}
              className="w-full bg-transparent border-none outline-none resize-none min-h-[60px] italic text-base"
              placeholder="Quote..."
              style={{ color: blockStyle.color }}
            />
          </div>
        );

      default:
        return null;
    }
  };

  const toolbarWidth = 280;
  const sidebarWidth = 336;
  const spacing = 32;
  const totalReservedWidth = toolbarWidth + sidebarWidth + (spacing * 2);
  const availableWidth = typeof window !== 'undefined' ? window.innerWidth - totalReservedWidth : 1200;
  const canvasWidth = Math.min(availableWidth, 1400);
  const canvasMargin = typeof window !== 'undefined' ? toolbarWidth + spacing + ((window.innerWidth - totalReservedWidth - canvasWidth) / 2) : 300;

  const maxSectionEnd = formData.background_sections.length > 0
    ? Math.max(...formData.background_sections.map(s => s.endPosition))
    : 2000;
  const canvasHeight = Math.max(maxSectionEnd + 500, 2000);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-y-auto bg-[#0A0A0A]">
      {message && (
        <div
          className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-[200] p-4 rounded-lg ${message.type === 'success'
            ? 'bg-green-500/10 border border-green-500/20 text-green-400'
            : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}
        >
          {message.text}
        </div>
      )}

      <div className="fixed top-4 left-4 z-[150] flex flex-col gap-2">
        <button
          onClick={() => addContentBlock('paragraph')}
          className="btn-muted"
          title="Add Paragraph"
        >
          <Plus size={14} />
          <AlignLeft size={14} />
        </button>
        <button
          onClick={() => addContentBlock('heading')}
          className="btn-muted"
          title="Add Heading"
        >
          <Plus size={14} />
          <Type size={14} />
        </button>
        <button
          onClick={() => addContentBlock('image')}
          className="btn-muted"
          title="Add Image"
        >
          <Plus size={14} />
          <ImageIcon size={14} />
        </button>
        <button
          onClick={() => addContentBlock('video')}
          className="btn-muted"
          title="Add Video"
        >
          <Plus size={14} />
          <VideoIcon size={14} />
        </button>
        <button
          onClick={() => addContentBlock('blockquote')}
          className="btn-muted"
          title="Add Quote"
        >
          <Plus size={14} />
          <Quote size={14} />
        </button>
      </div>
      {showPublishConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#111111] rounded-xl p-6 w-full max-w-md">
            <h3 className="text-[#EEEEEE] text-sm font-semibold mb-2">
              Publish without complete article info?
            </h3>

            <p className="text-[#999999] text-xs mb-4 leading-relaxed">
              Author profile details, links, or hero image are not filled.
              This may affect how your article appears publicly.
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowPublishConfirm(false)}
                className="px-4 py-2 text-xs rounded-lg bg-[rgba(255,255,255,0.06)] text-[#AAAAAA] hover:bg-[rgba(255,255,255,0.1)]"
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  setShowPublishConfirm(false);
                  handlePublish();
                }}
                className="px-4 py-2 text-xs rounded-lg bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
              >
                Publish anyway
              </button>
            </div>
          </div>
        </div>
      )}

      <aside className="fixed top-4 right-4 w-80 z-[60] space-y-3 max-h-[calc(100vh-2rem)] overflow-y-auto">
        <div className="sidebar-panel">
          <button
            onClick={() => handleSave(false)}
            disabled={saving || !formData.title}
            className="btn-muted w-full justify-center py-2.5 mb-2"
          >
            <Save size={14} />
            Save Draft
          </button>
          <button
            onClick={handlePublishClick}
            disabled={saving || !formData.title}
            className="w-full px-6 py-2.5 bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.12)] text-[#EEEEEE] rounded-lg transition-all duration-300 flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Eye size={14} />
            Publish
          </button>
          {!formData.title && (
            <p className="text-red-400 text-xs mt-1 text-center">
              Title is required to publish
            </p>
          )}

        </div>
        <div className="sidebar-panel">
          <h4 className="mb-3">Article Info</h4>
          <div className="space-y-2">
            <input
              type="text"
              value={formData.title}
              onChange={(e) => updateField('title', e.target.value)}
              className="w-full form-input text-sm"
              placeholder="Article Title *"
            />
            <input
              type="text"
              value={formData.subtitle}
              onChange={(e) => updateField('subtitle', e.target.value)}
              className="w-full form-input text-sm"
              placeholder="Subtitle"
            />
            <input
              type="text"
              value={formData.category}
              onChange={(e) => updateField('category', e.target.value)}
              className="w-full form-input text-sm"
              placeholder="Category"
            />
            <input
              type="text"
              value={formData.author_name}
              onChange={(e) => updateField('author_name', e.target.value)}
              className="w-full form-input text-sm"
              placeholder="Author Name"
            />
            <div className="pt-2">
              <label className="text-[#666666] text-xs mb-1.5 block">Hero Image</label>
              <input
                type="text"
                value={formData.hero_image_url}
                onChange={(e) => updateField('hero_image_url', e.target.value)}
                className="w-full form-input text-sm mb-2"
                placeholder="Paste image URL"
              />
              <ImageUpload
                type="image"
                onSelect={(file, previewUrl) => {
                  updateField('hero_image_url', previewUrl);

                  // OPTIONAL: store file separately if you want to upload hero image on publish
                  setFormData(prev => ({
                    ...prev,
                    heroImageFile: file, // add this to FormData type
                  }));
                }}
                className="w-full"
              />
            </div>
          </div>
        </div>
        <div className="sidebar-panel">
          <div className="flex items-center justify-between mb-3">
            <h4>Profiles</h4>
            <button onClick={addProfile} className="text-[#666666] hover:text-[#999999] transition-colors">
              <Plus size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {formData.profiles.map((profile, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="flex-1 space-y-1">
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => updateProfile(index, 'name', e.target.value)}
                    className="w-full form-input text-xs"
                    placeholder="Name"
                  />
                  <input
                    type="text"
                    value={profile.role}
                    onChange={(e) => updateProfile(index, 'role', e.target.value)}
                    className="w-full form-input text-xs"
                    placeholder="Role"
                  />
                </div>
                <button
                  onClick={() => deleteProfile(index)}
                  className="text-[#444444] hover:text-red-400"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="sidebar-panel">
          <div className="flex items-center justify-between mb-3">
            <h4>Links</h4>
            <button onClick={addLink} className="text-[#666666] hover:text-[#999999] transition-colors">
              <Plus size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {formData.links.map((link, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="flex-1 space-y-1">
                  <input
                    type="text"
                    value={link.title}
                    onChange={(e) => updateLink(index, 'title', e.target.value)}
                    className="w-full form-input text-xs"
                    placeholder="Title"
                  />
                  <input
                    type="url"
                    value={link.url}
                    onChange={(e) => updateLink(index, 'url', e.target.value)}
                    className="w-full form-input text-xs"
                    placeholder="URL"
                  />
                </div>
                <button
                  onClick={() => deleteLink(index)}
                  className="text-[#444444] hover:text-red-400"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="sidebar-panel">
          <h4 className="mb-3 flex items-center gap-2">
            <Palette size={14} />
            Theme Colors
          </h4>
          <div className="space-y-2">
            <ColorPicker
              label="Background"
              color={formData.theme_colors.background}
              onChange={(color) =>
                updateField('theme_colors', { ...formData.theme_colors, background: color })
              }
            />
            <ColorPicker
              label="Text"
              color={formData.theme_colors.text}
              onChange={(color) =>
                updateField('theme_colors', { ...formData.theme_colors, text: color })
              }
            />
            <ColorPicker
              label="Primary"
              color={formData.theme_colors.primary}
              onChange={(color) =>
                updateField('theme_colors', { ...formData.theme_colors, primary: color })
              }
            />
          </div>
        </div>

        <BackgroundManager
          sections={formData.background_sections}
          onChange={(sections) => updateField('background_sections', sections)}
        />
      </aside>

      <div className="relative w-full" style={{ height: `${canvasHeight}px` }}>
        <div
          className="absolute top-0 z-[5] overflow-hidden"
          style={{
            left: `${canvasMargin}px`,
            width: `${canvasWidth}px`,
            height: `${canvasHeight}px`
          }}
        >
          {renderBackgroundSections()}

          <AlignmentGuides
            activeX={alignmentX}
            activeY={alignmentY}
            elements={formData.content.map((block) => ({
              x: block.position.x,
              y: block.position.y,
              width: block.size?.width || 0,
              height: block.size?.height || 0,
            }))}
          />

          <main className="relative z-10 p-20" style={{ minHeight: `${canvasHeight}px` }}>
            {formData.content.length === 0 && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                <p className="text-[#666666] text-lg mb-3">Click buttons above to add elements</p>
                <p className="text-[#444444] text-sm">Drag them anywhere to position</p>
              </div>
            )}


            {formData.content.map((block) => (
              <DraggableElement
                key={block.id}
                id={block.id}
                position={block.position}
                size={block.size}
                onPositionChange={(position) => updateContentBlock(block.id, { position })}
                onSizeChange={(size) => updateContentBlock(block.id, { size })}
                onDelete={() => deleteContentBlock(block.id)}
                onAlignmentChange={handleAlignmentChange}
                resizable={block.type === 'image' || block.type === 'video'}
              >
                {renderContentBlock(block)}
              </DraggableElement>
            ))}
          </main>
        </div>
      </div>
    </div>
  );
}
