# Swiper

A local Windows desktop app for ranking a folder of photos and videos through rapid, head-to-head comparisons. Videos play directly in the comparison cards.

## Run it

```powershell
pnpm.cmd install
pnpm.cmd start
```

## Create a portable Windows executable

```powershell
pnpm.cmd package
```

The portable executable will be placed in `dist/`. It includes the runtime needed to run on another Windows PC. Images and videos are read directly from the selected folder and are never uploaded.
