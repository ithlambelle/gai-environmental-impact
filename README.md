# gai environmental impact visualization

a 3d interactive visualization exploring the environmental impact of generative ai through an animated betta fish model.

## running the site

the project uses es modules and requires a local web server. you can run it using python's built-in server:

```bash
python3 -m http.server 8000
```

then open your browser and navigate to:

```
http://localhost:8000
```

alternatively, if you have node.js installed, you can use:

```bash
npx http-server
```

## how to use

- drag the timeline slider to change years (2020-2050) and see the fish's appearance change over time
- click on glowing scale flares on the fish to view environmental impact facts
- hover over glowing areas around the fish to see information about different environmental concerns
- drag to rotate the camera around the fish
- scroll or pinch to zoom in and out

## technical details

- built with three.js for 3d rendering
- uses es modules (no build step required)
- three.js is loaded from cdn
- all assets are included in the repository

## project structure

- `index.html` - main entry point
- `src/main.js` - main three.js scene and animation logic
- `src/blueprint.js` - blueprint overlay effect
- `styles.css` - styling
- `betta_splendens.glb` - 3d fish model
- `assets/` - textures and scale images

