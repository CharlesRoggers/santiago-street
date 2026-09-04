# Santiago Street

Fútbol callejero 3v3 multijugador en una ciudad viva inspirada en Santiago.
Web 3D (navegador + Android como PWA). Monorepo TypeScript.

> Estado: **fundación / vertical slice en construcción**. Ver `CLAUDE.md` §3 para el
> estado real de cada sistema (IMPLEMENTED / PROTOTYPE / PLANNED). Nada aquí es un mock
> disfrazado de producción.

## Correr

```bash
pnpm install
pnpm dev          # cliente → http://localhost:5173  (partido 3v3 offline contra bots)
pnpm dev:server   # servidor autoritativo → ws://localhost:2567
pnpm check        # typecheck + tests + build
```

Controles: `WASD` mover · `Shift` sprint · `Espacio` pase · `Q` globo · `K` (mantener) tiro ·
`L` quite · `Tab` cambiar jugador. Gamepad y táctil soportados.

## Estructura

- `packages/shared` — simulación determinista (60 Hz), IA, schemas, recompensas, protocolo.
- `packages/client` — render Three.js, input, HUD, PWA.
- `packages/server` — sala de partido autoritativa (Colyseus), persistencia abstracta.
- `packages/content` — ciudades, distritos, canchas, metro y textos como datos.
- `docs/` — directiva maestra, ADRs, arquitectura, legal, producción.

## Documentos clave

- `docs/production/master-directive.md` — la directiva completa del proyecto.
- `docs/adr/` — decisiones de arquitectura (empezar por ADR-000).
- `docs/production/roadmap.md` — fases e hitos.
- `docs/legal/ip-policy.md` y `docs/legal/geodata.md` — propiedad intelectual y datos geográficos.
