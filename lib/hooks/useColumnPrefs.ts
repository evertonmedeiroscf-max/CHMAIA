'use client'

import { useEffect, useState } from 'react'

type StoredPrefs = { order?: string[]; hidden?: string[] }

export function useColumnPrefs(storageKey: string, defaultOrder: string[]) {
  const [order, setOrder] = useState<string[]>(defaultOrder)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as StoredPrefs
        const merged = (parsed.order ?? []).filter((k) => defaultOrder.includes(k))
        // Coluna criada depois que a ordem foi salva: encaixa logo após a
        // que a precede na ordem padrão, em vez de cair no fim da tabela.
        defaultOrder.forEach((key, i) => {
          if (merged.includes(key)) return
          const anterior = i > 0 ? merged.indexOf(defaultOrder[i - 1]) : -1
          merged.splice(anterior + 1, 0, key)
        })
        setOrder(merged)
        setHidden(new Set((parsed.hidden ?? []).filter((k) => defaultOrder.includes(k))))
      }
    } catch {
      // localStorage indisponível (modo privado, quota) — segue com os padrões
    }
    setLoaded(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  useEffect(() => {
    if (!loaded) return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ order, hidden: Array.from(hidden) }))
    } catch {
      // preferências simplesmente não persistem
    }
  }, [storageKey, order, hidden, loaded])

  function isVisible(key: string) {
    return !hidden.has(key)
  }

  function toggleVisible(key: string) {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function reorder(newOrder: string[]) {
    setOrder(newOrder)
  }

  return { order, isVisible, toggleVisible, reorder }
}
