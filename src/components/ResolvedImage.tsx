import React, { useState, useEffect } from "react";
import { isHeic, convertHeicBase64ToJpeg } from "../utils/heicHelper";

interface ResolvedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  key?: React.Key;
  src: string;
  alt?: string;
  className?: string;
  onLoad?: (event?: any) => void;
  onError?: (event?: any) => void;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
}

export default function ResolvedImage({ src, alt = "", className = "", onLoad, onError, ...props }: ResolvedImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(() => {
    if (!src || !isHeic(src)) {
      return src;
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(() => !!src && isHeic(src));
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!src) {
      setResolvedSrc("");
      setIsLoading(false);
      setHasError(false);
      return;
    }

    if (!isHeic(src)) {
      setResolvedSrc(src);
      setIsLoading(false);
      setHasError(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setHasError(false);

    convertHeicBase64ToJpeg(src)
      .then((jpegSrc) => {
        if (active) {
          setResolvedSrc(jpegSrc);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error("Não foi possível processar esta foto:", err);
        if (active) {
          setHasError(true);
          setIsLoading(false);
          if (onError) onError();
        }
      });

    return () => {
      active = false;
    };
  }, [src, onError]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 text-gray-500 font-semibold text-[10px] select-none p-4 ${className}`}>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-ping" />
          Carregando foto...
        </span>
      </div>
    );
  }

  if (hasError || !resolvedSrc) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 text-red-500 font-semibold text-[10px] text-center select-none p-4 leading-normal ${className}`}>
        Não foi possível processar esta foto
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      onLoad={onLoad}
      onError={onError}
      {...props}
    />
  );
}
