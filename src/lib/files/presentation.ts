"use client";

import { readZipEntries } from "./zipReader";

interface SlideText {
  number: number;
  paragraphs: string[];
}

const textDecoder = new TextDecoder();

export async function convertPptxToHtml(arrayBuffer: ArrayBuffer) {
  const entries = await readZipEntries(arrayBuffer);
  const slides = entries
    .map((entry) => {
      const match = entry.path.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
      if (!match) return null;
      return {
        number: Number(match[1]),
        xml: textDecoder.decode(entry.data),
      };
    })
    .filter((slide): slide is { number: number; xml: string } => Boolean(slide))
    .sort((left, right) => left.number - right.number)
    .map<SlideText>((slide) => ({
      number: slide.number,
      paragraphs: extractSlideParagraphs(slide.xml),
    }));

  if (slides.length === 0) {
    return "<p>这个 PowerPoint 文件没有可读取的幻灯片。</p>";
  }

  const visibleSlides = slides.filter((slide) => slide.paragraphs.length > 0);
  if (visibleSlides.length === 0) {
    return "<p>这个 PowerPoint 文件没有生成可见文本内容。</p>";
  }

  return visibleSlides.map(renderSlide).join("");
}

function extractSlideParagraphs(xml: string) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) return [];

  return Array.from(doc.getElementsByTagName("*"))
    .filter((node) => node.localName === "p")
    .map((paragraph) =>
      Array.from(paragraph.getElementsByTagName("*"))
        .filter((node) => node.localName === "t")
        .map((node) => node.textContent ?? "")
        .join("")
    )
    .map(normalizeSlideText)
    .filter(Boolean);
}

function renderSlide(slide: SlideText) {
  const [firstParagraph, ...rest] = slide.paragraphs;
  const title = firstParagraph || `第 ${slide.number} 页`;
  const body = rest.length
    ? `<ul>${rest.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
    : "";

  return `<section><h2>第 ${slide.number} 页：${escapeHtml(
    title
  )}</h2>${body}</section>`;
}

function normalizeSlideText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
