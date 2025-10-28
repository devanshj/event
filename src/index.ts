import { pipeWith as p } from "pipe-ts"

// ----------------------------------------
// Definition

export interface EventStream<T>
  { (subscriber: (value: T) => void): Unsubscribe}

type Unsubscribe =
  () => void

type Subscribe =
  <T>(f: (v: T) => void) => ($: EventStream<T>) => Unsubscribe

export interface HasFirstValue
  { readonly __hasFirstValue: unique symbol }

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
  <$ extends EventStream<unknown>, U>
  (f: (t: $ extends EventStream<infer T> ? T : never) => U) =>
    ($: $) =>
      & EventStream<U>
      & ($ extends HasFirstValue ? HasFirstValue : unknown) 

type MapImpl = 
  (f: (t: "T") => "U") =>
    ($: EventStream<"T">) => EventStream<"U">

export const mapImpl: MapImpl = f =>
  $ => s => p($, subscribe(t => s(f(t))))

export const map = mapImpl as Map




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
  <$s extends EventStream<unknown>[]>($s: [...$s]) =>
    & EventStream<{ [I in keyof $s]: $s[I] extends EventStream<infer V> ? V : never }>
    & ($s[number] extends HasFirstValue ? HasFirstValue : unknown)

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
  <T$s extends EventStream<unknown>[], U$ extends EventStream<unknown>>($: [...T$s]) =>
    ($: U$) =>
      & EventStream<
          [ U$ extends EventStream<infer U> ? U : never
          , ...{ [I in keyof T$s]: T$s[I] extends EventStream<infer V> ? V : never }
          ]>
      & ((U$ | T$s[number]) extends HasFirstValue ? HasFirstValue : unknown)

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

type Of =
  <T>(a: T) =>
    EventStream<T> & HasFirstValue

type OfImpl = 
  (a: "T") => EventStream<"T">

const ofImpl: OfImpl = a =>
  s => (s(a), () => {})

export const of = ofImpl as Of




// ----------------------------------------
// Semigroup

type Merge = 
  <T$s extends EventStream<unknown>[]>($s: [...T$s]) =>
    & EventStream<{ [I in keyof T$s]: T$s[I] extends EventStream<infer V> ? V : never }[number]>
    & (UnionToIntersection<T$s[number]> extends HasFirstValue ? HasFirstValue : unknown)

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
  <T$ extends EventStream<unknown>, U$ extends EventStream<unknown>>
  (f: (t: T$ extends EventStream<infer T> ? T : never) => U$) =>
    ($: T$) =>
      & EventStream<U$ extends EventStream<infer U> ? U : never>
      & ([T$, U$] extends [HasFirstValue, HasFirstValue] ? HasFirstValue : unknown)

type FlatMapImpl =
  (f: (t: "T") => EventStream<"U">) =>
    ($: EventStream<"T">) => EventStream<"U">

const flatMapImpl: FlatMapImpl = f => $ => s => {
  let dU = () => {}
  let dT = p($, subscribe(t => {
    dU()
    dU = p(f(t), subscribe(s))
  }))
  return () => (dT(), dU())
}

export const flatMap = flatMapImpl as FlatMap



// ----------------------------------------
// Fold

type Reduce =
  <T, A>(f: (a: A, t: T) => A, a: A) =>
    ($: EventStream<T>) => EventStream<A> & HasFirstValue

type ReduceImpl =
  (f: (a: "A", t: "T") => "A", a: "A") =>
    ($: EventStream<"T">) => EventStream<"A">

const reduceImpl: ReduceImpl = (f, a) => $ =>
  s => (s(a), p($, subscribe(t => s(a = f(a, t)))))

export const reduce = reduceImpl as Reduce


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
// Miscellenous 

type Previous =
  <T$ extends EventStream<unknown>, S extends [seed: unknown] | []>($: T$, ...a: S) =>
    & EventStream<
        | (T$ extends EventStream<infer T> ? T : never)
        | (S extends [infer I] ? I : never)
      >
    & ( S extends [unknown]
          ? T$ extends HasFirstValue ? HasFirstValue : unknown
          : unknown
      )

type PreviousImpl = 
  ($: EventStream<"T">, ...a: ["U"] | []) =>
    EventStream<"T" | "U">

const previousImpl: PreviousImpl = ($, ...a) => s => {
  let hasSeed = a.length === 1
  let pV: "T" | "U" | undefined = a[0];
  let didEmitFirst = false;
  let hasPrev = didEmitFirst || hasSeed
  return p($, subscribe(v => {
    if (hasPrev) s(pV!)
    pV = v;
    if (!didEmitFirst) didEmitFirst = true
  }))
}

export const previous = previousImpl as Previous



// ----------------------------------------
// Internal utils

const nothing = Symbol("nothing")
type Nothing = typeof nothing

type AEvery = <T extends unknown[], U>(t: T, p: (t: T[number]) => t is U) => t is T & U[]
const aEvery = ((t: any, p: any) => t.every(p)) as AEvery

const isNotNothing =
  <T>(t: T): t is Exclude<T, Nothing> => t !== nothing

type UnionToIntersection<U> =
  (U extends unknown ? (u: U) => void : never) extends (i: infer I) => void
    ? I
    : never