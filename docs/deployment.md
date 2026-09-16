# Ejecución y despliegue

No se ha publicado este proyecto ni se han introducido credenciales externas. Estos son pasos preparados para el operador. Lee primero `external-services.md`.

## Local sin cuentas externas

Requisitos: Node 24 (22 compatible con el proyecto), pnpm indicado en packageManager, Docker Desktop/Engine y Compose >= 2.24.4. Usa un disco con espacio suficiente para imágenes y compilaciones. No borres volúmenes para resolver un error de compilación.

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm setup:local
docker compose up -d postgres-users postgres-orders postgres-drivers postgres-notifications rabbitmq redis mailpit
pnpm backup:local
docker compose up -d --build
pnpm db:seed
pnpm admin:create
```

`setup:local` genera secretos aleatorios sin mostrarlos ni crear cuentas. Si existe .env, conserva las conexiones y contraseñas persistentes PostgreSQL/RabbitMQ: cambiarlas solo en el archivo NO cambia las contraseñas de volúmenes ya creados. El servicio aplica migraciones aditivas al arrancar. En una instalación antigua crea la copia **antes** de reconstruir los servicios de aplicación. Los seeds incluyen borradores y configuración operativa, no cuentas, productos ni pedidos ficticios. Revisa y publica tus textos legales; las tarifas de envíos permanecen inactivas hasta habilitación administrativa.

Web/gateway: http://localhost. Mailpit: http://localhost:8025 (solo receptor local). Comprueba `/api/users/ready`, `/api/orders/ready`, `/api/drivers/ready` y `/api/notifications/ready`. `/health` únicamente comprueba que el proceso responde, no que sus dependencias funcionan.

Audio local opcional: `docker compose --profile audio up -d livekit`. Es un servidor real, no un mock. En dispositivos físicos configura LIVEKIT_URL y LIVEKIT_NODE_IP con direcciones alcanzables; micrófono en navegador requiere un contexto seguro. No se afirma audio E2E hasta probar dos participantes.

## Producción

1. Copia `.env.production.example` a `.env.production` **en tu servidor** y complétalo con el gestor de secretos. No reutilices secretos locales. Mantén permisos de lectura limitados. Configura DNS y certificados reales antes de iniciar el proxy TLS.
2. Ejecuta la verificación local y guarda evidencias de la versión que desplegarás:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:migrations
pnpm test:concurrency
pnpm test:e2e
pnpm check:production
```

La última comprobación valida variables y archivos de certificados, pero no llama a proveedores ni demuestra la emisión del certificado. Firebase, LiveKit y Mercado Pago pueden quedar ausentes y deshabilitados. SMTP y S3 sí son necesarios para operar cuentas y archivos en producción. No ignores un fallo de configuración ni uses el Compose local como sustituto.

3. Construye las imágenes, inicia infraestructura y toma un respaldo si ya hay datos:

```powershell
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml config --quiet
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml build
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml up -d postgres-users postgres-orders postgres-drivers postgres-notifications rabbitmq redis
pnpm backup:production
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml up -d
```

El overlay no inicia Mailpit ni LiveKit local. Configura LiveKit Cloud o un despliegue propio aparte. Los contenedores de aplicación se ejecutan sin root. Mantén bases y colas en red privada; para proveedores gestionados adapta conexiones/dependencias con una revisión de despliegue, sin abrir sus puertos al público.

4. Inicializa solo configuración operacional y crea la cuenta real, desde el contenedor correspondiente:

```powershell
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml exec users-service node node_modules/tsx/dist/cli.mjs prisma/seed.ts
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml exec orders-service node node_modules/tsx/dist/cli.mjs prisma/seed.ts
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml exec users-service node scripts/admin-create.mjs
```

El comando de administrador es interactivo, no muestra la contraseña y no sobrescribe una cuenta existente. Luego publica documentos revisados, configura tarifas y aprueba solicitudes reales con evidencia. No habilites un medio de pago sin completar su información real.

5. Verifica HTTPS, cookies seguras, CORS, rechazo público de `/internal/*`, carga/lectura privada de archivos, correo real, sesiones y un ciclo de entrega controlado. Prueba restauración de copias en un entorno separado antes de aceptar pedidos públicos. Nunca restaures sobre una base viva sin una decisión operacional explícita.

## Respaldo y recuperación

Los comandos de respaldo crean cuatro dumps PostgreSQL formato custom y un manifest con `complete=true` solo si todos terminaron. No modifican registros. Cifra las copias, muévelas a almacenamiento separado con acceso limitado y valida su restauración con pg_restore en cuatro bases nuevas. Un dump no sustituye una prueba de recuperación. Respaldar también bucket S3, secretos de cifrado, certificados, configuración y estado persistente de RabbitMQ. No publiques estos archivos.

Para revertir una versión de aplicación, conserva sus imágenes identificadas por digest y revisa compatibilidad con las migraciones aditivas. No ejecutes automáticamente down-migrations ni `docker compose down -v`. Una migración que falló se investiga y resuelve expresamente; no se marca aplicada sin comprobar su esquema.

## Apps Android

Dentro de **cada** app, configura sus variables de EAS o su `.env.local` ignorado. La raíz .env de Docker no se lee automáticamente desde Expo. Emulador Android: http://10.0.2.2/api y http://10.0.2.2; equipo físico: IP LAN del servidor y firewall restringido a esa red. Producción: EXPO_PUBLIC_API_URL y EXPO_PUBLIC_SOCKET_URL HTTPS explícitas.

```powershell
cd apps/mobile-client
pnpm dlx eas-cli login
pnpm dlx eas-cli init
pnpm dlx eas-cli build --platform android --profile preview
pnpm dlx eas-cli build --platform android --profile production
```

Repite desde `apps/mobile-driver` con el proyecto EAS y google-services.json de repartidor. Iniciar una compilación alojada puede consumir cuota/coste y solicita la cuenta del operador; no fue ejecutado automáticamente. EAS init puede vincular el proyecto: conserva el identificador en EXPO_EAS_PROJECT_ID según tu entorno. Para compilación local instala Android SDK y JDK compatibles, ejecuta `expo prebuild --platform android` y el build de Gradle con tu configuración de firma. No hace falta publicar una app para generar un APK interno.

Las apps usan WebRTC nativo y requieren development build, no Expo Go. Exportar a web o Android JavaScript no genera un APK/AAB. El seguimiento GPS actualmente es de primer plano: la app del repartidor debe mantenerse visible; suspensión/bloqueo del dispositivo requiere validación y trabajo de segundo plano antes de prometer seguimiento continuo.

### Compilación local de evaluación en Windows

Desde cada carpeta de app, con `JAVA_HOME` apuntando a Java 21 y `ANDROID_HOME` al SDK instalado:

```powershell
node node_modules/expo/bin/cli prebuild --platform android --no-install
$env:NODE_ENV='production'
$env:EXPO_NO_TELEMETRY='1'
cd android
.\gradlew.bat :app:assembleRelease --no-daemon --max-workers 2 -PreactNativeArchitectures=arm64-v8a
```

El plugin `plugins/native-build.cjs` fija CMake 3.31.6 para los módulos Android solo cuando Gradle se ejecuta en Windows. Evita depender del Ninja antiguo de CMake 3.22.1, asociado a fallos de rutas largas ([explicación en Expo](https://github.com/expo/expo/issues/36274)). El SDK puede descargar CMake, NDK 27.1.12297006, plataforma 36 y Build Tools faltantes; reserva espacio y acepta sus licencias personalmente si aún no lo has hecho. La corrección permanece al regenerar `android`; no requiere editar `node_modules` ni mover el proyecto.

La salida esperada, **solo después de BUILD SUCCESSFUL**, es `android/app/build/outputs/apk/release/app-release.apk`. `assembleRelease` por sí solo no acredita firma de producción: la configuración local generada usa firma de depuración. Sin URLs explícitas apunta al emulador `10.0.2.2`; un teléfono físico requiere regenerar con las URLs LAN/HTTPS correspondientes. No distribuir este binario como app pública. `NODE_ENV=production` optimiza el bundle, pero no sustituye `APP_VARIANT=production`, las credenciales externas ni la configuración de firma.

`metro.config.cjs` alinea la raíz del servidor con la app únicamente durante `export:embed` y mantiene el workspace visible para resolver las dependencias de pnpm. Esto corrige el empaquetado nativo sin modificar la configuración de desarrollo/exportación web. No quitar ese ajuste al regenerar Android.
