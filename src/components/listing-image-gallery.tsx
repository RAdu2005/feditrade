"use client";

import { useEffect, useState } from "react";

type GalleryImage = {
  id: string;
  url: string;
};

type Props = {
  images: GalleryImage[];
  altBase: string;
};

export function ListingImageGallery({ images, altBase }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    if (activeIndex === null) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveIndex(null);
        return;
      }
      if (event.key === "ArrowLeft") {
        setActiveIndex((current) => {
          if (current === null) return current;
          return current === 0 ? images.length - 1 : current - 1;
        });
        return;
      }
      if (event.key === "ArrowRight") {
        setActiveIndex((current) => {
          if (current === null) return current;
          return current === images.length - 1 ? 0 : current + 1;
        });
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [activeIndex, images.length]);

  if (images.length === 0) {
    return null;
  }

  const isOpen = activeIndex !== null;
  const activeImage = activeIndex !== null ? images[activeIndex] : null;

  function showPrevious() {
    setActiveIndex((current) => {
      if (current === null) return current;
      return current === 0 ? images.length - 1 : current - 1;
    });
  }

  function showNext() {
    setActiveIndex((current) => {
      if (current === null) return current;
      return current === images.length - 1 ? 0 : current + 1;
    });
  }

  return (
    <>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {images.map((image, index) => (
          <button
            key={image.id}
            type="button"
            className="h-64 w-full overflow-hidden rounded border border-slate-200 bg-slate-50"
            onClick={() => setActiveIndex(index)}
            aria-label={`Open image ${index + 1} in gallery view`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt={altBase} className="h-full w-full object-contain" />
          </button>
        ))}
      </div>

      {isOpen && activeImage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setActiveIndex(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Image gallery"
        >
          <button
            type="button"
            onClick={() => setActiveIndex(null)}
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/40 text-lg text-white"
            aria-label="Close gallery"
          >
            x
          </button>

          {images.length > 1 ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                showPrevious();
              }}
              className="absolute left-4 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 text-xl text-white"
              aria-label="Previous image"
            >
              {"<"}
            </button>
          ) : null}

          <div
            className="relative flex h-full w-full max-w-6xl items-center justify-center"
            onClick={(event) => event.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeImage.url}
              alt={altBase}
              className="max-h-[92vh] w-auto max-w-full object-contain"
            />
          </div>

          {images.length > 1 ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                showNext();
              }}
              className="absolute right-4 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 text-xl text-white"
              aria-label="Next image"
            >
              {">"}
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
