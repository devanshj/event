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