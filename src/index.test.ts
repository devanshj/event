import * as Ev from "./index.ts"
import { pipeWith as p } from "pipe-ts"
import { test } from "node:test"
import { deepStrictEqual } from "node:assert"

test("take", () => {
  let dCalls: boolean[] = []
  let $: Ev.EventStream<number> = s => (s(1), s(2), s(3), s(4), () => (dCalls.push(true)))
  let es: number[] = []
  p($, Ev.take(2), Ev.subscribe(x => {
    es.push(x)
  }))
  deepStrictEqual(es, [1, 2])
  deepStrictEqual(dCalls, [true])
})

test("combine types", () => {
  let t$: Ev.EventStream<"T"> & Ev.HasFirstValue = Ev.of("T")
  let u$: Ev.EventStream<"U"> = Ev.of("U")

  let t0 = Ev.combine([t$])
  areTypesEqual<typeof t0, Ev.EventStream<["T"]> & Ev.HasFirstValue>() satisfies true

  let t1 = Ev.combine([u$])
  areTypesEqual<typeof t1, Ev.EventStream<["U"]>>() satisfies true

  let t2 = Ev.combine([t$, t$])
  areTypesEqual<typeof t2, Ev.EventStream<["T", "T"]> & Ev.HasFirstValue>() satisfies true

  let t3 = Ev.combine([u$, u$])
  areTypesEqual<typeof t3, Ev.EventStream<["U", "U"]>>() satisfies true

  let t4 = Ev.combine([t$, u$])
  areTypesEqual<typeof t4, Ev.EventStream<["T", "U"]>>() satisfies true
})

test("merge types", () => {
  let t$: Ev.EventStream<"T"> & Ev.HasFirstValue = Ev.of("T")
  let u$: Ev.EventStream<"U"> = Ev.of("U")

  let t0 = Ev.merge([t$])
  areTypesEqual<typeof t0, Ev.EventStream<"T"> & Ev.HasFirstValue>() satisfies true

  let t1 = Ev.merge([u$])
  areTypesEqual<typeof t1, Ev.EventStream<"U">>() satisfies true

  let t2 = Ev.merge([t$, t$])
  areTypesEqual<typeof t2, Ev.EventStream<"T"> & Ev.HasFirstValue>() satisfies true

  let t3 = Ev.merge([u$, u$])
  areTypesEqual<typeof t3, Ev.EventStream<"U">>() satisfies true

  let t4 = Ev.merge([t$, u$])
  areTypesEqual<typeof t4, Ev.EventStream<"T" | "U"> & Ev.HasFirstValue>() satisfies true
})

const areTypesEqual = (() => true) as 
 <A, B>() =>
    (<T>() => T extends A ? 1 : 0) extends (<T>() => T extends B ? 1 : 0)
      ? true
      : false