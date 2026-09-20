'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  Activity,
  BadgeCheck,
  CheckCircle2,
  Copy,
  KeyRound,
  MessageSquare,
  ShieldCheck,
  CreditCard,
} from 'lucide-react'
import { SectionHeading } from '@/components/SectionHeading'
import { SectionReveal } from '@/lib/motion'

/* ---------- Mini in-phone UI primitives ---------- */

function StatusBar({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between px-4 pb-2">
      <p className="text-xs font-bold">{title}</p>
      <span className="flex items-center gap-1 text-[10px] font-semibold text-success">
        <span
          className="h-1.5 w-1.5 rounded-full bg-success"
          aria-hidden
        />{' '}
        relay on
      </span>
    </div>
  )
}

function SenderDashboard() {
  return (
    <div className="px-4">
      <div className="flex items-center gap-2.5 rounded-2xl border border-blue/20 bg-bg-blue p-3">
        <CreditCard
          className="h-5 w-5 text-blue"
          aria-hidden
        />
        <div className="flex-1">
          <p className="text-[11px] font-bold text-ink">SIM 1 · Home</p>
          <p className="text-[10px] text-muted">+880 1711 •••••</p>
        </div>
        <span className="rounded-full bg-success/15 px-2 py-0.5 text-[9px] font-bold text-success">
          LIVE
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-2xl border border-blue/20 bg-bg-blue p-3">
        <div className="flex items-center gap-2">
          <Activity
            className="h-4 w-4 text-cyan"
            aria-hidden
          />
          <p className="text-[11px] font-semibold text-ink">Relay status</p>
        </div>
        <p className="text-[10px] font-medium text-muted">
          0 pending · 12 delivered
        </p>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-2xl border border-blue/20 bg-bg-blue p-3">
        <div className="flex items-center gap-2">
          <KeyRound
            className="h-4 w-4 text-blue"
            aria-hidden
          />
          <p className="text-[11px] font-semibold text-ink">Device pairing</p>
        </div>
        <BadgeCheck
          className="h-4 w-4 text-success"
          aria-hidden
        />
      </div>
    </div>
  )
}

function DevicePairing() {
  return (
    <div className="px-4">
      <div className="grid place-items-center rounded-2xl border border-blue/25 bg-bg-blue p-5">
        {/* QR placeholder */}
        <div className="grid grid-cols-3 gap-0.75 rounded-md bg-white p-2 shadow-sm">
          {Array.from({ length: 9 }).map((_, i) => (
            <span
              key={i}
              className={`h-4 w-4 ${[0, 2, 4, 6, 8].includes(i) ? 'bg-navy' : 'bg-bg'}`}
            />
          ))}
        </div>
        <p className="mt-3 text-[10px] font-bold tracking-wide text-blue">
          PAIR RECEIVER
        </p>
      </div>
      <p className="mt-3 rounded-xl border border-blue/20 bg-bg-blue p-3 text-center text-[10px] leading-relaxed text-muted">
        Scan from the Receiver app. Device keys are exchanged over a secure
        channel.
      </p>
    </div>
  )
}

function ReceiverInbox() {
  const rows = [
    {
      from: 'BANK',
      text: 'Your verification code is 839421',
      status: 'Delivered',
      ok: true,
    },
    {
      from: 'VISA',
      text: 'Payment of $49.00 approved',
      status: 'Delivered',
      ok: true,
    },
    {
      from: 'TravelGov',
      text: 'Your entry code is 9132',
      status: 'Pending',
      ok: false,
    },
  ]
  return (
    <div className="px-4">
      {rows.map((m) => (
        <div
          key={m.text}
          className="mb-2.5 flex items-start gap-2.5 rounded-2xl border border-line p-3"
        >
          <MessageSquare
            className="mt-0.5 h-4 w-4 shrink-0 text-blue"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
              {m.from}
            </p>
            <p className="truncate text-[11px] font-medium text-ink">
              {m.text}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${
              m.ok ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'
            }`}
          >
            {m.status}
          </span>
        </div>
      ))}
    </div>
  )
}

function OTPDetail() {
  return (
    <div className="px-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
        BANK · VERIFICATION
      </p>
      <div className="mt-2 rounded-2xl border border-blue/25 bg-bg-blue p-4 text-center">
        <p className="font-mono text-2xl font-extrabold tracking-[0.14em] text-ink">
          839421
        </p>
        <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] font-semibold text-blue">
          <Copy
            className="h-3 w-3"
            aria-hidden
          />{' '}
          Tap to copy
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-2xl border border-line p-3">
        <div>
          <p className="text-[11px] font-bold text-ink">Received from</p>
          <p className="text-[10px] text-muted">+880 1711 ••••• · 2 min ago</p>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-1 text-[9px] font-bold text-success">
          <CheckCircle2
            className="h-3 w-3"
            aria-hidden
          />{' '}
          Secure
        </span>
      </div>
    </div>
  )
}

/* ---------- Section ---------- */

const SENDER_SCREENS = [SenderDashboard, DevicePairing] as const
const RECEIVER_SCREENS = [ReceiverInbox, OTPDetail] as const
const SCREEN_LABELS = [
  'Sender Dashboard',
  'Device Pairing',
  'Receiver Inbox',
  'OTP Detail',
]

function PhoneFrame({
  tone,
  label,
  children,
}: {
  tone: 'dark' | 'light'
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="relative mx-auto w-fit">
      {/* Volume buttons */}
      <span
        className="absolute -left-0.75 top-22 h-16 w-0.75 rounded-l-xs bg-[#454c5c]"
        aria-hidden
      />
      <span
        className="absolute -left-0.75 top-42 h-16 w-0.75 rounded-l-xs bg-[#4a5162]"
        aria-hidden
      />
      {/* Power button */}
      <span
        className="absolute -right-0.75 top-34 h-24 w-0.75 rounded-r-xs bg-[#454c5c]"
        aria-hidden
      />

      <div className="relative rounded-[46px] bg-[#1b2029] p-1.75 shadow-card ring-1 ring-black/50">
        <div className="rounded-[40px] bg-linear-to-b from-[#2b313d] via-[#181d26] to-[#12161e] p-0.5">
          <div
            className={`relative h-129.5 w-60.5 overflow-hidden rounded-[38px] ${
              tone === 'dark' ? 'bg-navy-deep' : 'bg-white'
            }`}
          >
            {/* Punch-hole camera */}
            <div
              className="absolute left-1/2 top-4.5 z-20 h-2.75 w-2.75 -translate-x-1/2 rounded-full border border-white/10 bg-black shadow-[inset_0_0_3px_rgba(255,255,255,0.2)]"
              aria-hidden
            />

            <div
              className={`pt-10 ${tone === 'dark' ? 'text-white' : 'text-ink'}`}
            >
              <StatusBar title={label} />
              <AnimatePresence mode="wait">{children}</AnimatePresence>
            </div>

            {/* Glass glare */}
            <div
              className="pointer-events-none absolute inset-0 z-20 bg-linear-to-br from-white/8 via-transparent to-white/2"
              aria-hidden
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export function AppPreviewSection() {
  const reduce = useReducedMotion()
  const [senderIdx, setSenderIdx] = useState(0)
  const [receiverIdx, setReceiverIdx] = useState(0)

  useEffect(() => {
    if (reduce) return
    const a = setTimeout(
      () => setSenderIdx((i) => (i + 1) % SENDER_SCREENS.length),
      5200,
    )
    const b = setTimeout(
      () => setReceiverIdx((i) => (i + 1) % RECEIVER_SCREENS.length),
      5200,
    )
    return () => {
      clearTimeout(a)
      clearTimeout(b)
    }
  }, [senderIdx, receiverIdx, reduce])

  const SenderScreen = SENDER_SCREENS[senderIdx]
  const ReceiverScreen = RECEIVER_SCREENS[receiverIdx]

  return (
    <section className="relative overflow-hidden bg-navy-deep py-24 text-white sm:py-32">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
      >
        <div className="absolute inset-0 bg-grid-dark mask-[radial-gradient(ellipse_70%_50%_at_50%_30%,black,transparent)]" />
        <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-blue/20 blur-3xl" />
        <div className="absolute -right-24 bottom-24 h-72 w-72 rounded-full bg-cyan/15 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          dark
          eyebrow="App preview"
          title="Built for the phone in your hand."
          subtitle="A focused, premium interface for the Sender and Receiver."
        />

        <div className="mt-14 grid items-center justify-items-center gap-12 lg:grid-cols-[1fr_auto_1fr]">
          <SectionReveal className="w-full">
            <div className="flex flex-col items-center gap-4">
              <PhoneFrame
                tone="dark"
                label="Sender"
              >
                <motion.div
                  key={senderIdx}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  <SenderScreen />
                </motion.div>
              </PhoneFrame>
              <p className="text-sm font-semibold text-white/80">
                {SCREEN_LABELS[senderIdx]}
              </p>
            </div>
          </SectionReveal>

          {/* mid connector */}
          <motion.div
            aria-hidden
            className="hidden h-px w-24 bg-linear-to-r from-blue/50 to-cyan/50 lg:block"
            animate={reduce ? { opacity: 0.5 } : { opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 3, repeat: Infinity }}
          />

          <SectionReveal
            delay={0.15}
            className="w-full"
          >
            <div className="flex flex-col items-center gap-4">
              <PhoneFrame
                tone="light"
                label="Receiver"
              >
                <motion.div
                  key={receiverIdx}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  <ReceiverScreen />
                </motion.div>
              </PhoneFrame>
              <p className="text-sm font-semibold text-white/80">
                {SCREEN_LABELS[2 + receiverIdx]}
              </p>
            </div>
          </SectionReveal>
        </div>

        <SectionReveal
          delay={0.2}
          className="mt-14"
        >
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs font-medium text-muted-dark">
            <span className="flex items-center gap-1.5">
              <Activity
                className="h-3.5 w-3.5 text-cyan-light"
                aria-hidden
              />{' '}
              Live relay dashboard
            </span>
            <span
              className="hidden h-1 w-1 rounded-full bg-white/30 sm:block"
              aria-hidden
            />
            <span className="flex items-center gap-1.5">
              <ShieldCheck
                className="h-3.5 w-3.5 text-cyan-light"
                aria-hidden
              />{' '}
              Secure message cards
            </span>
            <span
              className="hidden h-1 w-1 rounded-full bg-white/30 sm:block"
              aria-hidden
            />
            <span className="flex items-center gap-1.5">
              <KeyRound
                className="h-3.5 w-3.5 text-cyan-light"
                aria-hidden
              />{' '}
              QR device pairing
            </span>
          </p>
        </SectionReveal>
      </div>
    </section>
  )
}
