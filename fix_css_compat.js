const fs = require('fs');

let css = fs.readFileSync('styles.css', 'utf8');

// 1. Replace `inset: 0` with top/right/bottom/left: 0
css = css.replace(/inset:\s*0;/g, 'top: 0; right: 0; bottom: 0; left: 0;');

// 2. Replace `inset: calc(...)` with individual properties  
css = css.replace(/inset:\s*calc\(([^)]+)\)\s+(\d+px)\s+auto\s+(\d+px);/g,
    'top: calc($1); right: $2; bottom: auto; left: $3;');

// 3. Replace min() with fallback (add fallback before modern syntax)
// For `width: min(1200px, 94vw)` add `width: 94vw; width: min(1200px, 94vw);`
css = css.replace(/width:\s*min\((\d+px),\s*(\d+vw)\);/g,
    'width: $2; /* Fallback */\n  width: min($1, $2);');

// 4. Replace 100svh with 100vh fallback
css = css.replace(/100svh/g, '100vh');
css = css.replace(/min-height:\s*100vh;/g,
    'min-height: 100vh; /* Fallback */\n  min-height: 100dvh;');

// 5. Add -webkit-background-clip where background-clip: text is used
css = css.replace(/background-clip:\s*text;/g,
    '-webkit-background-clip: text;\n      background-clip: text;');

// 6. Add vendor prefix for appearance
css = css.replace(/appearance:\s*none;/g,
    '-webkit-appearance: none;\n  -moz-appearance: none;\n  appearance: none;');

// 7. Add prefix for user-select
css = css.replace(/user-select:\s*none;/g,
    '-webkit-user-select: none;\n      -moz-user-select: none;\n      -ms-user-select: none;\n      user-select: none;');

// 8. Write the fixed CSS
fs.writeFileSync('styles.css', css, 'utf8');

console.log('CSS compatibility fixes applied!');
console.log('Fixed: inset, min(), 100svh, background-clip, user-select');
