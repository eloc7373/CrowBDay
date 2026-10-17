// Print-ready PDF: the map scaled to fit one page, with a title and a scale bar.

import { jsPDF } from 'jspdf'
import type { MapDoc } from '../layers/model'
import { fitToPage, niceScaleFeet, slugName, type Paper } from './layout'
import { renderMap, type RenderOptions } from './render'

export interface PdfOptions {
  paper: Paper
  /** Page margin in mm. */
  margin: number
  render: Omit<RenderOptions, 'cellPx'>
}

const FOOTER_MM = 16
/** Raster resolution for the map image inside the PDF. */
const TARGET_DPI = 200

export function exportPdf(doc: MapDoc, o: PdfOptions): { blob: Blob; filename: string } {
  const fit = fitToPage(doc.width, doc.height, o.paper, o.margin, FOOTER_MM)
  // Choose an integer px-per-cell giving ~200 dpi at the printed size (capped for memory).
  const cellPx = Math.max(8, Math.min(140, Math.round((fit.mmPerCell / 25.4) * TARGET_DPI)))
  const canvas = renderMap(doc, { ...o.render, cellPx })

  const pdf = new jsPDF({
    orientation: fit.orientation,
    unit: 'mm',
    format: [o.paper.w, o.paper.h],
  })
  pdf.setProperties({ title: doc.name, creator: 'DM Toolkit' })
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', fit.x, fit.y, fit.w, fit.h, undefined, 'FAST')
  pdf.setDrawColor(60)
  pdf.setLineWidth(0.3)
  pdf.rect(fit.x, fit.y, fit.w, fit.h)

  // Footer: title on the left, scale bar on the right.
  const baseY = fit.y + fit.h + 8
  pdf.setFontSize(11)
  pdf.setTextColor(20)
  pdf.text(doc.name, fit.x, baseY)
  pdf.setFontSize(8)
  pdf.setTextColor(90)
  pdf.text(
    `${doc.width}×${doc.height} squares · 1 square = ${doc.grid.feetPerCell} ft · ${fit.mmPerCell.toFixed(1)} mm per square`,
    fit.x,
    baseY + 4.5,
  )

  const feetPerMm = doc.grid.feetPerCell / fit.mmPerCell
  const barFeet = niceScaleFeet(Math.min(fit.w / 3, 80) * feetPerMm, doc.grid.feetPerCell)
  const barMm = barFeet / feetPerMm
  const cells = Math.round(barFeet / doc.grid.feetPerCell)
  const bx = fit.x + fit.w - barMm
  const by = baseY - 3
  for (let i = 0; i < cells; i++) {
    // Alternating black/white segments, one per square.
    const shade = i % 2 ? 255 : 30
    pdf.setFillColor(shade, shade, shade)
    pdf.rect(bx + (i * barMm) / cells, by, barMm / cells, 2.2, 'FD')
  }
  pdf.setFontSize(7)
  pdf.setTextColor(40)
  pdf.text('0', bx, by + 5.5, { align: 'center' })
  pdf.text(`${barFeet} ft`, bx + barMm, by + 5.5, { align: 'center' })

  return { blob: pdf.output('blob'), filename: `${slugName(doc.name)}_print.pdf` }
}
