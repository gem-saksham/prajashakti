/**
 * PhotoGallery — thumbnail strip + lightbox via yet-another-react-lightbox.
 */
import { useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

const MEDIA_PROXY = '/api/v1/media/';

function resolveUrl(url) {
  if (!url) return '';
  if (url.includes('localhost:4566') || url.includes('localstack')) {
    const match = url.match(/\/([^/]+\/[^/]+)$/);
    return match ? `${MEDIA_PROXY}${match[1]}` : url;
  }
  return url;
}

export default function PhotoGallery({ photos }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  if (!photos?.length) return null;

  const slides = photos.map((p) => ({ src: resolveUrl(p.url), alt: p.caption ?? '' }));

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            photos.length === 1 ? '1fr' : photos.length === 2 ? '1fr 1fr' : 'repeat(3, 1fr)',
          gap: 4,
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {photos.slice(0, 3).map((photo, i) => {
          const isLast = i === 2 && photos.length > 3;
          return (
            <button
              key={i}
              onClick={() => {
                setIndex(i);
                setOpen(true);
              }}
              style={{
                position: 'relative',
                padding: 0,
                border: 'none',
                cursor: 'pointer',
                background: '#000',
                aspectRatio: photos.length === 1 ? '16/9' : '1',
                overflow: 'hidden',
              }}
            >
              <img
                src={resolveUrl(photo.url)}
                alt={photo.caption ?? `Photo ${i + 1}`}
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              {isLast && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(0,0,0,0.55)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 18,
                    fontWeight: 800,
                  }}
                >
                  +{photos.length - 3}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <Lightbox
        open={open}
        close={() => setOpen(false)}
        index={index}
        slides={slides}
        styles={{ container: { backgroundColor: 'rgba(0,0,0,0.9)' } }}
      />
    </div>
  );
}
