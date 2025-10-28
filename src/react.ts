import * as Re from "react"
import * as Ev from "."
import { pipeWith as p } from "pipe-ts"

type UseValue = 
  < T$ extends Ev.EventStream<unknown>
  , A extends (T$ extends Ev.HasFirstValue ? [] : [firstValue?: unknown])
  >
  ($: T$, ...maybeFirstValue: A) =>
    | (T$ extends Ev.EventStream<infer T> ? T : never)
    | ( T$ extends Ev.HasFirstValue
          ? never
          : A extends [] ? undefined :
            A extends [infer X] ? X :
            undefined
      )

type UseValueImpl = 
  ($: Ev.EventStream<"T">, initialValue: "T") => "T"

const useValueImpl: UseValueImpl = ($, initialValue) => {
  type T = typeof $ extends Ev.EventStream<infer T> ? T : never

  let valueRef = Re.useRef(initialValue as T)
  let forceUpdate = Re.useReducer(a => a + 1, 0)[1]

  let isSyncSubscriberCall = Re.useRef(true)
  let unsubscribe = Re.useState(() =>
    p($, Ev.subscribe(value => {
      valueRef.current = value
      if (!isSyncSubscriberCall.current) forceUpdate()
      isSyncSubscriberCall.current = false
    }))
  )[0]

  Re.useEffect(() => {
    return unsubscribe
  }, [])

  return valueRef.current
}

export const useValue = useValueImpl as UseValue