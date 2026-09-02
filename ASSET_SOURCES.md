# Asset Sources and Licenses

The Isaac demo uses public-domain artwork hosted by Wikimedia Commons as obstacle imagery. The game vendors small thumbnails in `public/assets` so gameplay does not depend on external image requests at runtime. No secret credentials are used for asset loading.

## Obstacle Images

- Johannes Vermeer, `Girl with a Pearl Earring`
  - Source: https://commons.wikimedia.org/wiki/File:Meisje_met_de_parel.jpg
  - Downloaded thumbnail: https://commons.wikimedia.org/wiki/Special:Redirect/file/Meisje_met_de_parel.jpg?width=330
  - Local path: `public/assets/girl-with-pearl-earring.jpg`
  - License/status: Public domain

- Leonardo da Vinci, `Mona Lisa`
  - Source: https://commons.wikimedia.org/wiki/File:Mona_Lisa.jpg
  - Downloaded thumbnail: https://commons.wikimedia.org/wiki/Special:Redirect/file/Mona_Lisa.jpg?width=330
  - Local path: `public/assets/mona-lisa.jpg`
  - License/status: Public domain

- Leonardo da Vinci, `Lady with an Ermine`
  - Source: https://commons.wikimedia.org/wiki/File:Lady_with_an_Ermine_-_Leonardo_da_Vinci_-_Google_Art_Project.jpg
  - Downloaded thumbnail: https://commons.wikimedia.org/wiki/Special:Redirect/file/Lady_with_an_Ermine_-_Leonardo_da_Vinci_-_Google_Art_Project.jpg?width=330
  - Local path: `public/assets/lady-with-ermine.jpg`
  - License/status: Public domain

## Generated in Code

- The yellow prop plane, clouds, sky, ground, HUD, and game effects are drawn with local HTML Canvas and CSS.
