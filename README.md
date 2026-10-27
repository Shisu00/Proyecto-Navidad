# Sistema Municipal de Gestión y Trazabilidad de Beneficios

Plataforma web para inscribir, validar y entregar beneficios a niños y niñas de 0 a 10 años, con trazabilidad completa de cada operación.

**Municipalidad de San Joaquín** · Proyecto Integrado (TIHI43) · INACAP

---

## ¿Qué hace?

- **Inscripción** de beneficiarios por las Juntas de Vecinos (JJVV), con identificación por RUT o IPE y validación automática de calidad de datos.
- **Revisión municipal** de inscripciones observadas, con justificación de duplicados y descarte con motivo.
- **Entrega en terreno** con lectura del QR de la cédula del adulto responsable (o ingreso manual del RUN), retiro estándar o subsidiario y anulación con trazabilidad.
- **Dashboard en vivo** con avance por territorio y JJVV, actualizado en tiempo real, más el log de entregas.
- **Proyección de compras** para la próxima campaña, basada en las tasas de entrega de la última campaña cerrada.
- **Administración** de usuarios, catálogos, campañas, roles y permisos, sin tocar código.

## Capturas

> Agregar capturas en `docs/screenshots/` una vez desplegado.

| Inscripción | Entrega | Dashboard |
|:-:|:-:|:-:|
| `docs/screenshots/inscription.png` | `docs/screenshots/delivery.png` | `docs/screenshots/dashboard.png` |

## Arquitectura

Un único cliente web conversa directamente con Supabase. No hay backend propio ni app móvil.

```text
Navegador (SPA React + Vite, en Vercel)  ──HTTPS──▶  Supabase Cloud
  JJVV · Municipal · Admin                             Auth (JWT) · PostgREST/RPC · Realtime · Edge Functions
                                                                │
                                                                ▼
                                                       PostgreSQL (RLS + RPC + auditoría)
```

Principios de diseño:

- **La seguridad vive en la base de datos** (RLS y funciones `SECURITY DEFINER`). El cliente no es una barrera de confianza.
- **Toda escritura de negocio pasa por RPC transaccionales.** No hay `INSERT`/`UPDATE` directo desde el cliente.
- **Nunca hay `DELETE` físico** sobre datos de negocio: se marca (`DISCARDED`, `is_active = false`, entrega anulada).
- **Auditoría inmutable:** `audit_log` rechaza `UPDATE`, `DELETE` y `TRUNCATE`, incluso para el administrador.
- **Solo dos Edge Functions** usan `service_role`, que nunca llega al navegador.

## Stack

| Capa | Tecnología |
|---|---|
| Cliente | React 19, Vite, `@supabase/supabase-js` |
| Backend / BaaS | Supabase: PostgreSQL, Auth, PostgREST, RLS, RPC (plpgsql), Realtime, Edge Functions (Deno) |
| Hosting | Vercel |
| Lectura de cédula | `BarcodeDetector` (`qr_code`, `pdf417`) |
| Pruebas | Vitest, Testing Library, SQL con shim de Supabase, Deno test |
| Lint | oxlint |

## Estructura del repositorio

```text
.
├── portal/                    # SPA React + Vite
│   └── src/
│       ├── components/        # Vistas (Login, Dashboard, Delivery, admin/…)
│       ├── hooks/             # useAsyncData, useAsyncAction, usePermissions, useRealtimeDeliveries
│       ├── services/          # Únicos importadores del cliente Supabase
│       └── lib/               # supabaseClient, rut, identification, cedulaScanner, labels, filters, uuid
├── supabase/
│   ├── migrations/            # Esquema, RLS, RPC y auditoría (inmutables una vez aplicadas)
│   ├── functions/
│   │   ├── admin-credentials/ # create_user · reset_password
│   │   └── change-password/   # Cambio de clave y baja de must_change_password
│   ├── tests/                 # *.test.sql + run.sh
│   └── seed.sql               # Solo desarrollo
├── docs/
├── ROADMAP.md
├── codestyle.md
└── README.md
```

Capas del cliente: **Vista → Hook → Servicio → SDK**. Ningún componente importa `supabase` directamente.

## Roles y permisos

Los roles son datos, no código: un rol nuevo se crea desde el panel de administración.

| Permiso | ADMIN | MUNICIPAL_OFFICER | NEIGHBORHOOD_USER (JJVV) |
|---|:-:|:-:|:-:|
| Crear y editar inscripciones propias | Sí | — | Sí |
| Revisar inscripciones | Sí | Sí | — |
| Confirmar y anular entregas (solo su JJVV) | Sí | — | Sí |
| Ver planificación, calidad y auditoría | Sí | Sí | — |
| Gestionar cuentas territoriales | Sí | Sí | — |
| Gestionar catálogos y roles | Sí | — | — |

La interfaz se gobierna con `my_permissions()`, nunca con nombres de rol.

## Ciclo de una campaña

```text
PLANNED → REGISTRATION_OPEN → REGISTRATION_CLOSED → VALIDATION → DELIVERY_PLANNED → DELIVERY → CLOSED
```

- Inscripciones nuevas: solo en `REGISTRATION_OPEN`.
- Revisión municipal: desde `REGISTRATION_OPEN` hasta `DELIVERY`.
- Entregas y anulaciones: solo en `DELIVERY`.
- Avance de un estado a la vez; retroceso con motivo; `CLOSED` es terminal.

## Requisitos

- Node.js 20 o superior
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Docker (para Supabase local)
- [Deno](https://deno.com) (pruebas de Edge Functions)

## Puesta en marcha local

```bash
# 1. Instalar dependencias del portal
cd portal && npm install

# 2. Levantar Supabase local (aplica migraciones y seed)
supabase start
supabase db reset

# 3. Configurar variables del cliente
cp portal/.env.example portal/.env.local

# 4. Ejecutar el portal
cd portal && npm run dev
```

### Variables de entorno

**Cliente** (`portal/.env.local`; en Vercel, proyecto de Producción y Vista previa):

| Variable | Descripción |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave pública del proyecto |

**Edge Functions** (secretos de Supabase, nunca en el cliente):

| Variable | Descripción |
|---|---|
| `SUPABASE_URL` | URL del proyecto |
| `SUPABASE_ANON_KEY` | Clave anónima |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio |

### Usuarios demo (solo desarrollo)

El `seed.sql` crea cuentas de ejemplo para cada rol. **Producción no tiene seed ni cuentas demo.**

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo del portal |
| `npm run build` | Build estático a `dist/` |
| `npm run lint` | oxlint (debe terminar sin advertencias) |
| `npm run test` | Pruebas de cliente con Vitest |
| `bash supabase/tests/run.sh` | Pruebas SQL (migraciones + seed + `tests/*.test.sql`) |
| `deno test` (en `supabase/functions/`) | Pruebas de Edge Functions contra Supabase local |

## Pruebas

- **Cliente:** RUT, IPE, extracción de RUN, formulario de inscripción, diálogo de duplicado, `PasswordGate`, navegación por permisos, entrega y anulación.
- **SQL:** identificación, idempotencia, concurrencia, duplicados, aislamiento por JJVV, RBAC y anti-escalación, bloqueo por clave temporal, entregas, transiciones de campaña, proyección e inmutabilidad de la auditoría.
- **Edge Functions:** permisos, anti-escalación, compensación ante fallo y política de clave.
- **Rendimiento:** diseñado y probado para ~13.500 inscripciones.

## Despliegue

**Base de datos y funciones**

```bash
supabase link --project-ref <PROJECT_REF>
supabase db push
supabase secrets set SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=...
supabase functions deploy admin-credentials
supabase functions deploy change-password
```

> **Nunca edites una migración ya aplicada.** Los cambios van en una migración nueva.

**Portal (Vercel)**

- Comando de build: `npm run build` · directorio de salida: `dist/`
- `vercel.json` con reescritura hacia `index.html` y cabeceras de seguridad (`Content-Security-Policy`, `X-Content-Type-Options`, `frame-ancestors 'none'`, `Permissions-Policy: camera=(self)`).
- Registrar la URL de Vercel como *Site URL* en la configuración de Auth de Supabase.

**Primer ADMIN de producción:** se crea una única vez en el panel de Auth de Supabase y se le asigna perfil con un script SQL de arranque, con `must_change_password = true`.

## Seguridad y protección de datos

- Sin autoregistro: las cuentas las crea la Municipalidad desde el panel.
- Clave temporal obligatoria de cambiar: mientras `must_change_password` sea `true`, el servidor bloquea toda operación.
- La clave temporal se muestra una sola vez y se entrega por un canal ajeno al sistema; las claves nunca se registran en logs ni en auditoría.
- Minimización de datos: teléfono y correo son opcionales; el contenido crudo de la cédula nunca se almacena.
- Normativa de referencia: Ley 19.628, Ley 21.719 (verificar su vigencia vigente al citarla) y Ley 21.663.
- Los datos se conservan con la finalidad declarada de "campañas futuras" hasta que la Municipalidad defina un plazo.

## Compatibilidad del escáner

| Entorno | Lectura de cédula |
|---|---|
| Chrome en Android | Escaneo con cámara (`BarcodeDetector`) |
| iOS/Safari y otros sin soporte | Ingreso manual del RUN, con el mismo flujo posterior |

## Documentación

- [`SPECS.md`](./SPECS.md): especificación técnica completa
- [`ROADMAP.md`](./ROADMAP.md): ruta de trabajo
- [`codestyle.md`](./codestyle.md): reglas de código

## Contribuir

1. Lee [`codestyle.md`](./codestyle.md) antes de escribir código.
2. Crea una rama desde `main` y haz cambios pequeños y enfocados.
3. Ejecuta lint y todas las pruebas antes de abrir un PR.
4. Toda lógica de negocio nueva requiere prueba; todo cambio de esquema, una migración nueva.

## Licencia

Proyecto académico desarrollado para la Municipalidad de San Joaquín. Definir licencia y titularidad con la Municipalidad antes de publicar.
