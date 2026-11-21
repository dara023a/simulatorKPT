import type { Dataset, TextDoc } from '../types'
import { CATEGORY_NAMES, generateDocs } from './corpus'

const SAMPLE_NOTE =
  'Simulated sample inspired by the 20 Newsgroups topic list. It is not the full 18,846-document dataset and is generated locally, so the demo works offline.'

const MINI_NOTE =
  'Small deterministic sample used for quick walkthroughs. Every document is simulated text generated in the browser.'

export const SAMPLE_DATASET: Dataset = {
  id: 'newsgroups-sample',
  name: '20 Newsgroups · Simulated Sample',
  shortName: 'Newsgroups sample',
  description:
    '240 simulated documents spread across the 20 classic 20 Newsgroups categories. Word counts, task ranges and results are computed deterministically from this local corpus.',
  source: 'sample',
  categories: CATEGORY_NAMES,
  docs: generateDocs(240, 20260101),
  taskSize: 10,
  note: SAMPLE_NOTE,
}

export const MINI_DATASET: Dataset = {
  id: 'newsgroups-mini',
  name: 'Mini Newsgroups · Simulated Sample',
  shortName: 'Mini sample',
  description:
    '90 simulated documents across the same 20 categories. Useful for a fast demonstration with fewer tasks.',
  source: 'demo',
  categories: CATEGORY_NAMES,
  docs: generateDocs(90, 20260202, 'mini'),
  taskSize: 6,
  note: MINI_NOTE,
}

export const BUILT_IN_DATASETS: Dataset[] = [SAMPLE_DATASET, MINI_DATASET]

export function getDatasetById(id: string): Dataset {
  return BUILT_IN_DATASETS.find((dataset) => dataset.id === id) ?? SAMPLE_DATASET
}

export const DEFAULT_DATASET_ID = SAMPLE_DATASET.id

function makeTitle(text: string, index: number): string {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim().length > 0) ?? `Document ${index + 1}`
  const words = firstLine.trim().split(/\s+/).slice(0, 7).join(' ')
  return words.length > 72 ? `${words.slice(0, 69)}...` : words
}

export function createUploadedDataset(fileName: string, rawContent: string): Dataset {
  const normalized = rawContent.replace(/\r\n/g, '\n').trim()
  if (!normalized) throw new Error('The uploaded file is empty.')

  let chunks = normalized
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)

  if (chunks.length === 0) chunks = [normalized]
  chunks = chunks.slice(0, 250)

  const docs: TextDoc[] = chunks.map((chunk, index) => {
    const text = chunk.slice(0, 6000)
    return {
      id: `upload-${String(index + 1).padStart(3, '0')}`,
      title: makeTitle(text, index),
      category: 'uploaded.text',
      text,
    }
  })

  const taskSize = Math.max(1, Math.ceil(docs.length / 12))

  return {
    id: `upload-${Date.now()}`,
    name: fileName,
    shortName: fileName.length > 24 ? `${fileName.slice(0, 21)}...` : fileName,
    description:
      'Local text file uploaded in this browser session. Documents are separated by blank lines. Nothing is sent to a server.',
    source: 'upload',
    categories: ['uploaded.text'],
    docs,
    taskSize,
    note: 'Uploaded text is parsed locally in the browser. All analytics shown by the simulator are simulation results.',
  }
}
