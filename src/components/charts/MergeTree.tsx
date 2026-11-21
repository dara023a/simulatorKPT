import { Check, ChevronRight, Clock3, GitMerge, ServerCog } from 'lucide-react'
import type { MergeGroup, MergeMode } from '../../types'
import { groupMergeLayers } from '../../engine/sorting'
import { formatNumber } from '../../lib/format'
import { EmptyState, Tag, cx } from '../ui/Primitives'

export function MergeTree({
  groups,
  mergeMode,
  compact = false,
}: {
  groups: MergeGroup[]
  mergeMode: MergeMode
  compact?: boolean
}) {
  if (groups.length === 0) {
    return (
      <EmptyState
        title="Merge tree belum terbentuk"
        hint="Merge tree muncul setelah semua sorted run kembali ke master."
      />
    )
  }

  const layers = groupMergeLayers(groups)
  const merged = groups.filter((group) => group.status === 'merged').length
  const tiered = groups.filter((group) => group.workerId !== null).length

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Tag tone={mergeMode === 'tiered' ? 'blue' : 'cyan'}>
          <GitMerge size={10} />
          {mergeMode === 'tiered' ? 'tiered merge' : 'master merge tree'}
        </Tag>
        <Tag tone={merged === groups.length ? 'emerald' : 'amber'}>
          {merged}/{groups.length} groups merged
        </Tag>
        {tiered > 0 && <Tag tone="blue">{tiered} worker-tier merges</Tag>}
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max items-stretch gap-2">
          {layers.map((layer, layerIndex) => (
            <div key={layer.level} className="flex items-center gap-2">
              <div className={cx('rounded-lg border border-line bg-ink-850/50 p-2', compact ? 'w-[230px]' : 'w-[300px]')}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="text-[9px] font-semibold tracking-[0.1em] text-faint uppercase">
                    Level {layer.level}
                  </p>
                  <span className="text-[9px] text-faint">{layer.groups.length} groups</span>
                </div>
                <p className="mb-1.5 text-[9px] text-muted">{layer.label}</p>
                <div className={cx('grid gap-1', compact ? 'grid-cols-1' : 'grid-cols-2')}>
                  {layer.groups.map((group) => (
                    <div
                      key={group.id}
                      title={`${group.inputIds.join(' + ')} → ${formatNumber(group.outputSize)} items`}
                      className={cx(
                        'rounded border px-1.5 py-1',
                        group.status === 'merged'
                          ? 'border-emerald-500/20 bg-emerald-500/[0.05]'
                          : 'border-amber-400/20 bg-amber-400/[0.04]',
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate font-mono text-[8px] text-muted">{group.id}</span>
                        {group.status === 'merged' ? (
                          <Check size={9} className="shrink-0 text-emerald-400" />
                        ) : (
                          <Clock3 size={9} className="shrink-0 text-amber-400" />
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-[8px] text-faint">
                        {group.workerId ? (
                          <>
                            <ServerCog size={8} className="text-info" />
                            {group.workerId}
                          </>
                        ) : (
                          <>
                            <GitMerge size={8} className="text-accent" />
                            master
                          </>
                        )}
                      </div>
                      <p className="mt-0.5 text-[8px] text-faint">
                        {group.inputSizes.map((size) => formatNumber(size)).join(' + ')} →{' '}
                        {formatNumber(group.outputSize)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              {layerIndex < layers.length - 1 && (
                <ChevronRight size={14} className="shrink-0 text-faint" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
