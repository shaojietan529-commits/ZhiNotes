"use client";

type ZhiNoteLogoProps = {
  className?: string;
  title?: string;
};

type ZhiNoteMarkProps = ZhiNoteLogoProps & {
  framed?: boolean;
};

const colors = {
  ink: "#111821",
  blue: "#586CF2",
  teal: "#2BB8C7",
  paper: "#F4F6FB",
  orange: "#FFB33E",
};

function ZhiNoteMarkArtwork() {
  return (
    <>
      <path
        d="M146 50h76l-14 54h74v62h-85v60h78v62h-87c-11 64-40 116-88 156l-54-43c39-31 63-68 73-113H61v-62h64v-60H86v-26c27-32 47-69 60-110Z"
        fill={colors.blue}
      />
      <path
        d="M205 308l56 154h-70l-37-104c19-13 36-30 51-50Z"
        fill={colors.teal}
      />
      <path
        d="M298 96h126c45 0 80 35 80 80v172h-66V178c0-11-9-20-20-20H298V96Z"
        fill={colors.paper}
      />
      <rect x="300" y="374" width="100" height="62" fill={colors.paper} />
      <path d="M400 374h78l-78 78v-78Z" fill={colors.orange} />
      <rect x="316" y="202" width="116" height="24" rx="12" fill={colors.paper} />
      <rect x="316" y="256" width="110" height="24" rx="12" fill={colors.paper} />
      <rect x="316" y="310" width="82" height="24" rx="12" fill={colors.paper} />
    </>
  );
}

export function ZhiNoteMark({
  className,
  title = "ZhiNote mark",
  framed = false,
}: ZhiNoteMarkProps) {
  return (
    <svg
      aria-label={title}
      className={className}
      role="img"
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
    >
      {framed ? <rect width="512" height="512" rx="104" fill={colors.ink} /> : null}
      <ZhiNoteMarkArtwork />
    </svg>
  );
}

export function ZhiNoteLogo({ className, title = "ZhiNote" }: ZhiNoteLogoProps) {
  return (
    <svg
      aria-label={title}
      className={className}
      role="img"
      viewBox="0 0 620 160"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(0 6) scale(0.29)">
        <ZhiNoteMarkArtwork />
      </g>
      <text
        fill={colors.paper}
        fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
        fontSize="82"
        fontWeight="520"
        letterSpacing="0"
        x="174"
        y="105"
      >
        <tspan fill={colors.blue} fontWeight="760">
          Zh
        </tspan>
        <tspan fill={colors.teal} fontWeight="760">
          i
        </tspan>
        <tspan fill={colors.paper}>Note</tspan>
      </text>
      <circle cx="590" cy="91" r="12" fill={colors.orange} />
    </svg>
  );
}
