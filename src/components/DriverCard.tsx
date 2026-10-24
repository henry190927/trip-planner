import { useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { CarFront, X } from 'lucide-react'
import type { Place } from '../types'

// 全螢幕大字地址：直接把手機遞給計程車司機
export default function DriverCard({ place, phrase }: { place: Place; phrase?: string }) {
  const [open, setOpen] = useState(false)
  if (!place.addressLocal?.length) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-paper active:scale-95"
      >
        <CarFront className="size-3.5" />
        給司機看
      </button>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              role="dialog"
              aria-label="給司機看的地址"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-50 flex flex-col bg-white p-6 text-black"
            >
              <button type="button" aria-label="關閉" className="pt-safe ml-auto flex size-11 items-center justify-center rounded-full bg-black/5">
                <X className="size-6" />
              </button>
              <motion.div
                initial={{ scale: 0.96, y: 12 }}
                animate={{ scale: 1, y: 0 }}
                className="flex flex-1 flex-col justify-center"
              >
                {phrase && <p className="mb-6 text-2xl font-bold text-black/50">{phrase}</p>}
                {place.local && <p className="mb-4 text-3xl font-bold">{place.local}</p>}
                {place.addressLocal.map((line) => (
                  <p key={line} className="text-[2.6rem] font-black leading-tight tracking-tight">
                    {line}
                  </p>
                ))}
                <p className="mt-8 text-base text-black/50">{place.name}</p>
              </motion.div>
              <p className="pb-safe text-center text-sm text-black/40">點任何地方關閉</p>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
