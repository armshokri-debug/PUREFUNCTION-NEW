# Body figure — guide for redesigning the human drawing

The human drawing used in **Assessment › Body map** (posture + animated movements)
lives in ONE file:

    src/components/BodyFigure.tsx

You can redraw the body however you like (Gemini / AI Studio welcome), as long as
these rules hold:

1. Keep the component name and props exactly:
   `BodyFigure({ view, pose, ghost, ghostKeys, dots, showJoints, lines, arcs, labels, plumb, className, title })`
2. Joint positions come from `solve(view, pose)` in `src/lib/bodyModel.ts`.
   Draw each body part so it follows those joints (shoulder → elbow → wrist,
   hip → knee → ankle). That is what makes arms and legs move.
3. Keep the SVG `viewBox="-10 -70 320 620"` (labels and arcs are placed in it).
4. Do NOT change `src/lib/bodyModel.ts`, `src/components/BodyLab.tsx`, anything in
   `src/cloud/`, `supabase/`, or `.github/`.
5. Before pushing: `npm run lint` and `npm test` must pass.
   (The site only deploys when both pass, so a broken push never reaches users.)

Style reference: the InBody silhouette already in the app
(`InBodySegmentSilhouette` in `src/components/VisualAssets.tsx`) — light grey fill,
one dark continuous outline, fingers, thin dashed segment lines.
