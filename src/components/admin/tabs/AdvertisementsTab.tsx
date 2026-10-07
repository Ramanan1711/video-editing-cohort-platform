import React, { useState, useRef } from 'react';
import {
  Check,
  Clock,
  Edit2,
  ExternalLink,
  Eye,
  Image as ImageIcon,
  Layers,
  Megaphone,
  Plus,
  Radio,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { useToast } from '../../../context/useToast';
import {
  type Advertisement,
  type AdvertisementDisplayType,
  type CreateAdvertisementInput,
  type UpdateAdvertisementInput,
  resolveAdvertisementImageUrl,
  uploadAdvertisementImage,
} from '../../../lib/advertisementService';

export interface AdvertisementsTabProps {
  advertisements: Advertisement[];
  loading: boolean;
  onSaveAdvertisement: (
    input: CreateAdvertisementInput | UpdateAdvertisementInput,
    editingId?: string
  ) => Promise<void>;
  onDeleteAdvertisement: (id: string) => Promise<void>;
  onToggleActive: (id: string, nextActive: boolean) => Promise<void>;
}

export function AdvertisementsTab({
  advertisements,
  loading,
  onSaveAdvertisement,
  onDeleteAdvertisement,
  onToggleActive,
}: AdvertisementsTabProps) {
  const toast = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);
  const [previewAd, setPreviewAd] = useState<Advertisement | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formTagline, setFormTagline] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formCtaText, setFormCtaText] = useState('Learn More');
  const [formCtaLink, setFormCtaLink] = useState('#pricing');
  const [formBadgeText, setFormBadgeText] = useState('SPECIAL OFFER');
  const [formDisplayType, setFormDisplayType] = useState<AdvertisementDisplayType>('popup');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formPriority, setFormPriority] = useState(1);
  const [formExpiresAt, setFormExpiresAt] = useState('');

  const activeAdsCount = advertisements.filter((a) => a.is_active).length;
  const inactiveAdsCount = advertisements.filter((a) => !a.is_active).length;

  const filteredAds = advertisements.filter((ad) => {
    if (filter === 'active') return ad.is_active;
    if (filter === 'inactive') return !ad.is_active;
    return true;
  });

  const handleOpenCreate = () => {
    setEditingAd(null);
    setFormTitle('');
    setFormTagline('');
    setFormDescription('');
    setFormImageUrl('');
    setFormCtaText('Claim Offer');
    setFormCtaLink('#pricing');
    setFormBadgeText('LIMITED TIME OFFER');
    setFormDisplayType('popup');
    setFormIsActive(true);
    setFormPriority(1);
    setFormExpiresAt('');
    setShowModal(true);
  };

  const handleOpenEdit = (ad: Advertisement) => {
    setEditingAd(ad);
    setFormTitle(ad.title);
    setFormTagline(ad.tagline || '');
    setFormDescription(ad.description || '');
    setFormImageUrl(ad.image_url || '');
    setFormCtaText(ad.cta_text || 'Learn More');
    setFormCtaLink(ad.cta_link || '#pricing');
    setFormBadgeText(ad.badge_text || 'SPECIAL OFFER');
    setFormDisplayType(ad.display_type);
    setFormIsActive(ad.is_active);
    setFormPriority(ad.priority);
    setFormExpiresAt(ad.expires_at ? ad.expires_at.slice(0, 16) : '');
    setShowModal(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, WEBP, GIF, SVG).');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.error('Image size must be less than 8MB.');
      return;
    }

    setUploadingImage(true);
    try {
      const url = await uploadAdvertisementImage(file);
      setFormImageUrl(url);
      toast.success('Advertisement image uploaded successfully.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload image. Please try pasting an image URL instead.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error('Please provide an advertisement title.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateAdvertisementInput = {
        title: formTitle,
        tagline: formTagline || undefined,
        description: formDescription || undefined,
        image_url: formImageUrl || undefined,
        cta_text: formCtaText || undefined,
        cta_link: formCtaLink || undefined,
        badge_text: formBadgeText || undefined,
        display_type: formDisplayType,
        is_active: formIsActive,
        priority: Number(formPriority) || 0,
        expires_at: formExpiresAt ? new Date(formExpiresAt).toISOString() : null,
      };

      await onSaveAdvertisement(payload, editingAd?.id);
      setShowModal(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save advertisement.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Deck */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400">
              <Megaphone size={16} />
            </span>
            <h2 className="text-xl font-black text-slate-950 dark:text-white">
              Homepage Ads &amp; Promotional Campaigns
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Publish, schedule, and curate interactive advertisement popups and promotional banners displayed to homepage visitors.
          </p>
        </div>

        <Button
          onClick={handleOpenCreate}
          className="shadow-sm bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold"
        >
          <Plus size={15} />
          <span>New Advertisement</span>
        </Button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Campaigns</p>
            <p className="mt-0.5 text-2xl font-black text-slate-900 dark:text-white">{advertisements.length}</p>
          </div>
          <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <Layers size={18} />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-emerald-200/50 bg-emerald-50/20 dark:bg-emerald-950/10">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Active On Homepage</p>
            <p className="mt-0.5 text-2xl font-black text-emerald-700 dark:text-emerald-300">{activeAdsCount}</p>
          </div>
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
            <Radio size={18} className="animate-pulse" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Draft / Paused</p>
            <p className="mt-0.5 text-2xl font-black text-slate-600 dark:text-slate-400">{inactiveAdsCount}</p>
          </div>
          <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800">
            <Clock size={18} />
          </div>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex gap-2 text-xs font-bold">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-lg px-3 py-1.5 transition ${
              filter === 'all'
                ? 'bg-orange-500 text-white font-black'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            All ({advertisements.length})
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`rounded-lg px-3 py-1.5 transition ${
              filter === 'active'
                ? 'bg-orange-500 text-white font-black'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Active ({activeAdsCount})
          </button>
          <button
            onClick={() => setFilter('inactive')}
            className={`rounded-lg px-3 py-1.5 transition ${
              filter === 'inactive'
                ? 'bg-orange-500 text-white font-black'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Paused ({inactiveAdsCount})
          </button>
        </div>
      </div>

      {/* Advertisements List */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400">Loading advertisements...</div>
      ) : filteredAds.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-950/50 mb-3">
            <Megaphone size={22} />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">No Advertisements Found</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            {filter !== 'all'
              ? `No ${filter} advertisements match this filter.`
              : 'Create an announcement popup or promo banner to promote new cohorts, flash sales, or masterclasses on the homepage.'}
          </p>
          <Button onClick={handleOpenCreate} size="sm" className="mt-4">
            <Plus size={14} /> Create First Ad
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAds.map((ad) => {
            const isExpired = ad.expires_at && new Date(ad.expires_at).getTime() < Date.now();

            return (
              <Card
                key={ad.id}
                className={`overflow-hidden flex flex-col justify-between transition-all hover:shadow-md ${
                  ad.is_active && !isExpired
                    ? 'border-orange-200/80 dark:border-orange-950/40'
                    : 'opacity-75'
                }`}
              >
                <div>
                  {/* Media Header / Thumbnail */}
                  <div className="relative aspect-video w-full bg-slate-900 overflow-hidden flex items-center justify-center">
                    {ad.image_url ? (
                      <img
                        src={ad.image_url}
                        alt={ad.title}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          const target = e.currentTarget;
                          void resolveAdvertisementImageUrl(ad.image_url).then((resolved) => {
                            if (resolved && resolved !== target.src) {
                              target.src = resolved;
                            } else {
                              target.style.display = 'none';
                            }
                          });
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-600 gap-1.5 p-4 text-center">
                        <ImageIcon size={28} />
                        <span className="text-[10px] font-mono uppercase tracking-wider">No Media Attached</span>
                      </div>
                    )}

                    {/* Badge Pill */}
                    {ad.badge_text && (
                      <div className="absolute top-2.5 left-2.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-xs">
                          <Sparkles size={10} />
                          {ad.badge_text}
                        </span>
                      </div>
                    )}

                    {/* Display Type Pill */}
                    <div className="absolute top-2.5 right-2.5">
                      <span className="rounded-md bg-slate-950/80 backdrop-blur-sm border border-white/10 px-2 py-0.5 text-[9px] font-mono uppercase text-slate-300">
                        {ad.display_type}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[10px] font-mono text-slate-400">
                        Priority: {ad.priority}
                      </span>
                      {isExpired ? (
                        <span className="text-[10px] font-bold uppercase text-rose-500">Expired</span>
                      ) : ad.is_active ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-600">
                          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase text-slate-400">Paused</span>
                      )}
                    </div>

                    <h3 className="text-sm font-black text-slate-950 dark:text-white line-clamp-1">{ad.title}</h3>
                    {ad.tagline && (
                      <p className="mt-0.5 text-xs font-semibold text-orange-600 dark:text-orange-400 line-clamp-1">
                        {ad.tagline}
                      </p>
                    )}
                    {ad.description && (
                      <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {ad.description}
                      </p>
                    )}

                    {/* CTA Details */}
                    <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-900/60 p-2 text-[11px]">
                      <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[140px]">
                        {ad.cta_text || 'Learn More'}
                      </span>
                      <span className="text-[10px] text-slate-400 truncate max-w-[120px] font-mono">
                        {ad.cta_link || '#pricing'}
                      </span>
                    </div>

                    {ad.expires_at && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400">
                        <Clock size={11} />
                        <span>Expires: {new Date(ad.expires_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="border-t border-slate-100 dark:border-slate-800 p-3 flex items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-900/30">
                  <button
                    type="button"
                    onClick={() => onToggleActive(ad.id, !ad.is_active)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      ad.is_active
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {ad.is_active ? <Check size={12} /> : null}
                    <span>{ad.is_active ? 'Active' : 'Enable'}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPreviewAd(ad)}
                      className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-200/60 transition"
                      title="Preview how it looks on the Homepage"
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(ad)}
                      className="p-1.5 text-slate-500 hover:text-orange-600 rounded-lg hover:bg-slate-200/60 transition"
                      title="Edit Advertisement"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (window.confirm(`Delete advertisement "${ad.title}"?`)) {
                          await onDeleteAdvertisement(ad.id);
                        }
                      }}
                      className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                      title="Delete Advertisement"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-orange-500">
                  {editingAd ? 'Edit Campaign' : 'New Campaign'}
                </span>
                <h3 className="text-lg font-black text-slate-950 dark:text-white">
                  {editingAd ? 'Edit Homepage Advertisement' : 'Publish Homepage Advertisement'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* Title & Tagline */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Campaign Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Masterclass 50% Off Flash Pass"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tagline / Subheading
                  </label>
                  <input
                    type="text"
                    value={formTagline}
                    onChange={(e) => setFormTagline(e.target.value)}
                    placeholder="e.g. Only 15 Seats Reserved For Next Batch"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Badge Text & Display Type */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Badge Pill Text
                  </label>
                  <input
                    type="text"
                    value={formBadgeText}
                    onChange={(e) => setFormBadgeText(e.target.value)}
                    placeholder="e.g. FLASH SALE, SPECIAL OFFER"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Display Style
                  </label>
                  <select
                    value={formDisplayType}
                    onChange={(e) => setFormDisplayType(e.target.value as AdvertisementDisplayType)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="popup">Popup Lightbox (High-Impact Modal on Visit)</option>
                    <option value="banner">Sticky Top Banner (Top Header Bar)</option>
                    <option value="floating_card">Floating Cyber Card (Bottom Corner)</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Bullet Highlights
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Describe the offer, bonus assets, mentorship access, or urgency details..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Image Upload Area */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Advertisement Poster / Media
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={uploadingImage}
                    onClick={() => fileInputRef.current?.click()}
                    className="shrink-0"
                  >
                    <Upload size={14} />
                    <span>{uploadingImage ? 'Uploading...' : 'Upload Image File'}</span>
                  </Button>
                  <input
                    type="url"
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    placeholder="Or paste an image URL (https://...)"
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {formImageUrl && (
                  <div className="mt-2.5 relative aspect-video w-48 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950">
                    <img
                      src={formImageUrl}
                      alt="Preview"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        const target = e.currentTarget;
                        void resolveAdvertisementImageUrl(formImageUrl).then((resolved) => {
                          if (resolved && resolved !== target.src) {
                            target.src = resolved;
                          }
                        });
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setFormImageUrl('')}
                      className="absolute top-1 right-1 rounded-full bg-slate-950/80 p-1 text-white hover:bg-rose-600 transition"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>

              {/* CTA Text & Link */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Button Label
                  </label>
                  <input
                    type="text"
                    value={formCtaText}
                    onChange={(e) => setFormCtaText(e.target.value)}
                    placeholder="e.g. Claim 50% Off &amp; Enroll"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Destination Link
                  </label>
                  <input
                    type="text"
                    value={formCtaLink}
                    onChange={(e) => setFormCtaLink(e.target.value)}
                    placeholder="e.g. #pricing, /register, https://..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Priority, Expiration & Status */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Display Priority
                  </label>
                  <input
                    type="number"
                    value={formPriority}
                    onChange={(e) => setFormPriority(Number(e.target.value))}
                    min={0}
                    max={100}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Auto-Expire Date (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formExpiresAt}
                    onChange={(e) => setFormExpiresAt(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="size-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                    />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Enable Live On Homepage
                    </span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
                >
                  {submitting ? 'Saving...' : editingAd ? 'Update Advertisement' : 'Publish Advertisement'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TEST PREVIEW MODAL */}
      {previewAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="relative w-full max-w-lg rounded-3xl border border-surface-subtle bg-surface-card p-6 text-slate-100 shadow-2xl">
            <button
              onClick={() => setPreviewAd(null)}
              className="absolute top-4 right-4 rounded-full bg-surface-elevated p-1.5 text-slate-400 hover:text-white transition"
            >
              <X size={16} />
            </button>

            {previewAd.badge_text && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/20 border border-orange-500/40 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-orange-400 mb-3">
                <Sparkles size={11} /> {previewAd.badge_text}
              </span>
            )}

            {previewAd.image_url && (
              <div className="relative aspect-video w-full rounded-2xl overflow-hidden mb-4 border border-surface-subtle shadow-lg">
                <img
                  src={previewAd.image_url}
                  alt={previewAd.title}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    const target = e.currentTarget;
                    void resolveAdvertisementImageUrl(previewAd.image_url).then((resolved) => {
                      if (resolved && resolved !== target.src) {
                        target.src = resolved;
                      } else {
                        target.style.display = 'none';
                      }
                    });
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-card via-transparent to-transparent opacity-60" />
              </div>
            )}

            <h3 className="text-xl font-black tracking-tight text-white">{previewAd.title}</h3>
            {previewAd.tagline && (
              <p className="mt-1 text-xs font-bold text-orange-400">{previewAd.tagline}</p>
            )}
            {previewAd.description && (
              <p className="mt-2.5 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                {previewAd.description}
              </p>
            )}

            <div className="mt-6 flex items-center justify-between gap-3 pt-4 border-t border-surface-subtle">
              <span className="text-[10px] font-mono text-slate-500">
                Style: {previewAd.display_type} · Link: {previewAd.cta_link}
              </span>
              <a
                href={previewAd.cta_link || '#pricing'}
                onClick={(e) => {
                  e.preventDefault();
                  toast.info(`Clicked test CTA: ${previewAd.cta_link}`);
                  setPreviewAd(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-orange-500/20 hover:scale-105 transition"
              >
                <span>{previewAd.cta_text || 'Learn More'}</span>
                <ExternalLink size={13} />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
