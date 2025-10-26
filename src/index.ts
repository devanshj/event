import { pipeWith as p } from "pipe-ts"

// ----------------------------------------
// Definition

export interface EventStream<T>
  { (subscriber: (value: T) => void): Unsubscribe }

type Unsubscribe =
  () => void

type Subscribe =
  <T>(f: (v: T) => void) => ($: EventStream<T>) => Unsubscribe

export const subscribe: Subscribe = f => $ => {
  let u = false
  let d = $(v => {
    if (!u) f(v)
  })
  return () => { d(); u = true }
}




// ----------------------------------------
// Subject

type CreateSubject =
  <T>() => [EventStream<T>, (value: T) => void]

type CreateSubjectImpl = 
  () => [EventStream<"T">, (value: "T") => void]

const createSubjectImpl: CreateSubjectImpl = () => {
  let ss = [] as ((value: "T") => void)[]
  return [
    s => (ss.push(s), () => void ss.splice(ss.indexOf(s), 1)), 
    v => ss.forEach(s => s(v))
  ]
}

export const createSubject = createSubjectImpl as CreateSubject






// ----------------------------------------
// Functor

type Map =
  <T, U>(f: (t: T) => U) =>
    ($: EventStream<T>) => EventStream<U>

export const map: Map = f =>
  $ => s => p($, subscribe(t => s(f(t))))




// ----------------------------------------
// Filterable

type Filter =
  <T, U extends T = T>(f: ((t: T) => t is U) | ((t: T) => boolean)) =>
    ($: EventStream<T>) => EventStream<U>

type FilterImpl =
  (f: (t: "T") => boolean) =>
    ($: EventStream<"T">) => EventStream<"T">

const filterImpl: FilterImpl = f =>
  $ => s => p($, subscribe(t => f(t) && s(t)))

export const filter = filterImpl as Filter


type Take =
  (n: number) =>
    <T>($: EventStream<T>) => EventStream<T>

export const take: Take = n => n === 0 ? _$ => never : ($ => s => {
  let d = () => {}
  d = p($, subscribe(t => {
    if (n > 0) s(t)
    if (--n === 0) d()
  }))
  if (n <= 0) d()
  return d
})


type Skip =
  (n: number) =>
    <T>($: EventStream<T>) => EventStream<T>

export const skip: Skip = n => $ => s => p($, subscribe(t => {
  if (n-- <= 0) { s(t); return }
}))





// ----------------------------------------
// Apply

type Combine = 
  <Ts extends EventStream<unknown>[]>($s: [...Ts]) =>
    EventStream<{ [I in keyof Ts]: Ts[I] extends EventStream<infer V> ? V : never }>

type CombineImpl =
  ($s: EventStream<"T">[]) => EventStream<"T"[]>

const combineImpl: CombineImpl = $s => s => {
  let vs = $s.map(() => nothing as "T" | typeof nothing)
  let ds = [] as (() => void)[]
  let onValue = () => {
    if (aEvery(vs, isNotNothing)) s(vs)
  }

  $s.forEach(($, i) => {
    ds.push(p($, subscribe(v => {
      vs[i] = v
      onValue()
    })))
  })

  return () => ds.forEach(d => d())
}

export const combine = combineImpl as Combine




type SampleCombine =
  <Ts extends EventStream<unknown>[]>($: [...Ts]) =>
    <U>($: EventStream<U>) =>
      EventStream<
        [ U
        , ...{ [I in keyof Ts]: Ts[I] extends EventStream<infer V> ? V : never }
        ]>

type SampleCombineImpl =
  ($: EventStream<"T">[]) =>
    ($: EventStream<"U">) => EventStream<["U", ..."T"[]]>

const sampleCombineImpl: SampleCombineImpl = t$s => u$ => s => {
  let ts = t$s.map(() => nothing as Nothing | "T")
  let dTs = t$s.map((t$, i) => 
    p(t$, subscribe(t => {
      ts[i] = t
    }))
  )
  let dU = p(u$, subscribe(u => {
    if (!aEvery(ts, isNotNothing)) return
    s([u, ...ts])
  }))
  return () => (dTs.forEach(d => d()), dU())
}

export const sampleCombine = sampleCombineImpl as SampleCombine



// ----------------------------------------
// Applicative

type Of = <T>(a: T) => EventStream<T>
export const of: Of = a =>
  s => (s(a), () => {})




// ----------------------------------------
// Semigroup

type Merge = 
  <Ts extends EventStream<unknown>[]>($s: [...Ts]) =>
    EventStream<{ [I in keyof Ts]: Ts[I] extends EventStream<infer V> ? V : never }[number]>

type MergeImpl =
  ($s: EventStream<"T">[]) => EventStream<"T">

const mergeImpl: MergeImpl = $s => s => {
  let ds = $s.map($ => p($, subscribe(s)))
  return () => ds.forEach(d => d())
}

export const merge = mergeImpl as Merge




// ----------------------------------------
// Monoid

type Never = EventStream<never>
export const never: Never = _s => () => {}





// ----------------------------------------
// Bind

type FlatMap = 
  <T, U>(f: (t: T) => EventStream<U>) =>
    ($: EventStream<T>) => EventStream<U>

export const flatMap: FlatMap = f => $ => s => {
  let dU = () => {}
  let dT = p($, subscribe(t => {
    dU()
    dU = f(t)(s)
  }))
  return () => (dT(), dU())
}




// ----------------------------------------
// Fold

type Reduce =
  <T, A>(f: (a: A, t: T) => A, a: A) =>
    ($: EventStream<T>) => EventStream<A>

export const reduce: Reduce = (f, a) => $ =>
  s => (s(a), p($, subscribe(t => s(a = f(a, t)))))




// ----------------------------------------
// setTimeout interop

type Timeout =
  (ms: number) => EventStream<undefined>

export const timeout: Timeout = (ms: number) => s => {
  let i = setTimeout(() => s(undefined), ms)
  return () => clearTimeout(i)
}



// ----------------------------------------
// setInterval interop

type Interval =
  (ms: number) => EventStream<undefined>

export const interval: Interval = (ms: number) => s => {
  let i = setInterval(() => s(undefined), ms)
  return () => clearInterval(i)
}



// ----------------------------------------
// EventTarget interop

type FromEventTarget = 
  (eventTarget: EventTarget, eventType: string) => EventStream<Event>

export const fromEventTarget: FromEventTarget = (t, n) => s => {
  t.addEventListener(n, s)
  return () => t.removeEventListener(n, s)
}






// ----------------------------------------
// Internal utils

const nothing = Symbol("nothing")
type Nothing = typeof nothing

type AEvery = <T extends unknown[], U>(t: T, p: (t: T[number]) => t is U) => t is T & U[]
const aEvery = ((t: any, p: any) => t.every(p)) as AEvery

const isNotNothing =
  <T>(t: T): t is Exclude<T, Nothing> => t !== nothing
