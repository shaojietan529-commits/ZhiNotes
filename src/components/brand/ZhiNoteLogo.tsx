"use client";

type ZhiNoteLogoProps = {
  className?: string;
  title?: string;
};

type ZhiNoteMarkProps = ZhiNoteLogoProps & {
  framed?: boolean;
};

const horizontalLogoSrc = "/brand/source/zhinote-reference-horizontal.png";
const appIconSrc = "/brand/source/zhinote-reference-app-icon.png";

export function ZhiNoteMark({
  className,
  title = "ZhiNote mark",
}: ZhiNoteMarkProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={title}
      className={className}
      src={appIconSrc}
      style={{ display: "block", objectFit: "contain", objectPosition: "left center" }}
    />
  );
}

export function ZhiNoteLogo({ className, title = "ZhiNote" }: ZhiNoteLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={title}
      className={className}
      src={horizontalLogoSrc}
      style={{ display: "block", objectFit: "contain", objectPosition: "left center" }}
    />
  );
}
