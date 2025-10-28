import * as Re from "react"
import * as ReDom from "react-dom/client"
import * as Ev from "@devanshj/event"
import * as EvRe from "@devanshj/event/react"
import { pipeWith as p } from "pipe-ts"
import "./main.css"

const App = () => {
  let [boxes, setBoxes] = Re.useState(["A", "B", "C"]);
  let deleteBoxRef = Re.useRef<HTMLDivElement | null>(null);

  return <>
    <div className="boxes">
      {boxes.map(id =>
        <Box
          {...{ id, deleteBoxRef }}
          onDrop={() => setBoxes(boxes.filter(x => x !== id))}
          key={id} />
      )}
      <DeleteBox ref={deleteBoxRef}/>
    </div>
    <p className="hint">Drag and drop to delete</p>
  </>
}

const Box = ({ id, deleteBoxRef, onDrop: _onDrop }: { id: string, deleteBoxRef: Re.RefObject<HTMLElement | null>, onDrop: () => void }) => {
  let ref = Re.useRef<HTMLDivElement | null>(null)
  let [mouseDown$, sendMouseDown] = useConstant(() => Ev.createSubject<Re.MouseEvent>())
  let [touchStart$, sendTouchStart] = useConstant(() => Ev.createSubject<Re.TouchEvent>())
  let [transitionEnd$, sendTransitionEnd] = useConstant(() => Ev.createSubject<Re.TransitionEvent>())

  let isDragging$ = useConstant(() =>
    Ev.merge([
      Ev.of(false),
      p(Ev.merge([mouseDown$, touchStart$]), Ev.map(() => true)),
      p(Ev.merge([
        Ev.fromEventTarget(window, "mouseup"),
        Ev.fromEventTarget(window, "touchend"),
        Ev.fromEventTarget(document.documentElement, "mouseleave")
      ]), Ev.map(() => false))
    ])
  )
  let isDragging = EvRe.useValue(isDragging$)

  let draggingPositionDelta$ = useConstant(() => Ev.merge([
    Ev.of({ x: 0, y: 0 }),
    p(
      isDragging$,
      Ev.flatMap(isDragging => !isDragging ? Ev.never : p(
        Ev.merge([
          Ev.fromEventTarget(window, "mousemove") as Ev.EventStream<MouseEvent>,
          Ev.fromEventTarget(window, "touchmove") as Ev.EventStream<TouchEvent>
        ]),
        Ev.map(e => e.type === "mousemove" ? (e as MouseEvent) : (e as TouchEvent).touches[0]),
        Ev.map(e => ({ x: e.clientX, y: e.clientY })),
        $ => p($, Ev.sampleCombine([Ev.previous($, undefined)])),
        Ev.map(([c, p]) =>
          p === undefined ? { x: 0, y: 0 } :
          { x: c.x - p.x, y: c.y - p.y }
        ),
        Ev.reduce(
          (p, e) => ({ x: p.x + e.x, y: p.y + e.y }),
          { x: 0, y: 0 }
        )
      ))
    )
  ]))

  let canDrop = EvRe.useValue(useConstant(() => p(
    draggingPositionDelta$,
    Ev.map(({ x, y }) =>
      !ref.current || !deleteBoxRef.current ? false :
      doesIntersect({
        offsetLeft: ref.current.offsetLeft + x,
        offsetTop: ref.current.offsetTop + y,
        offsetWidth: ref.current.offsetWidth,
        offsetHeight: ref.current.offsetHeight
      }, deleteBoxRef.current)
    )
  )))
  let canDropRef = useReffed(canDrop)

  let didDrop = !isDragging && canDrop
  let didDropRef = useReffed(didDrop)

  let positionDelta = EvRe.useValue(useConstant(() => Ev.merge([
    Ev.of({ x: 0, y: 0 }),
    draggingPositionDelta$,
    p(
      Ev.merge([
        Ev.fromEventTarget(window, "mouseup"),
        Ev.fromEventTarget(window, "touchend")
      ]),
      Ev.filter(() => !canDropRef.current),
      Ev.map(() => ({ x: 0, y: 0 }))
    )
  ])))

  let shouldShrink = EvRe.useValue(useConstant(() => Ev.merge([
    Ev.of(false),
    p(
      transitionEnd$,
      Ev.filter(() => didDropRef.current),
      Ev.map(() => true)
    )
  ]))) === true
  let shouldShrinkRef = useReffed(shouldShrink)

  let onDrop = Re.useEffectEvent(_onDrop)
  useConstant(() => p(
    transitionEnd$,
    Ev.filter(() => shouldShrinkRef.current),
    Ev.subscribe(onDrop)
  ))

  useConstant(() => p(
    isDragging$,
    Ev.subscribe(v => {
      document.body.style.cursor = v ? "grabbing" : ""
    })
  ))

  return <div
    ref={ref}
    className="box-outer"
    style={shouldShrink ? {
      width: 0,
      marginRight: 0,
      transition: "width 0.2s ease"
    } : {}}>
      <div
        onMouseDown={sendMouseDown}
        onTouchStart={sendTouchStart}
        onTransitionEnd={sendTransitionEnd}
        className={["box", isDragging && "is-dragging"].filter(Boolean).join(" ")}
        style={{
          position: "absolute",
          marginLeft: positionDelta.x,
          marginTop: positionDelta.y,
          opacity: didDrop ? 0 : canDrop ? 0.7 : 1,
          transform: didDrop ? "scale(0)" : canDrop ? "scale(0.7)" : "scale(1)",
          transition: [
            "box-shadow", "opacity", "transform",
            !isDragging && "margin-left",
            !isDragging && "margin-top",
          ].filter(Boolean).map(x => x + " 0.2s ease").join(",")
        }}>
          <span>{id}</span>
      </div>
  </div>
}
export default App

const DeleteBox = ({ ref }: { ref: Re.Ref<HTMLDivElement> }) =>
  <div ref={ref} className="box delete">
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" />
    </svg>
  </div>

const doesIntersect = (a: Offset, b: Offset) =>
  [
    { x: a.offsetLeft, y: a.offsetTop },
    { x: a.offsetLeft + a.offsetWidth, y: a.offsetTop },
    { x: a.offsetLeft, y: a.offsetTop + a.offsetHeight },
    { x: a.offsetLeft + a.offsetWidth, y: a.offsetTop + a.offsetHeight }
  ].some(({ x, y }) =>
    b.offsetLeft <= x && x <= b.offsetLeft + b.offsetWidth &&
    b.offsetTop <= y && y <= b.offsetTop  + b.offsetHeight
  )

type Offset = {
  offsetLeft: number,
  offsetTop: number,
  offsetWidth: number,
  offsetHeight: number
}

const useConstant = <T,>(f: () => T) =>
  Re.useState(f)[0]

const useReffed = <T,>(a: T) => {
  let aRef = Re.useRef(a)
  aRef.current = a
  return aRef
}

ReDom.createRoot(document.getElementById("root")!).render(
  <Re.StrictMode>
    <App />
  </Re.StrictMode>,
)

