export interface FileItem { id:number;file:File; title:string; size:string; }
export interface GameDetails { status:string; author:string; genre:string; tags:string; }
export interface Media {file:File; url:string; type:string; }


export interface PageData {
  gameTitle:string;
  postTitle:string;
  postTag:string;
  postDate:string;
  author:string;
  italicQuote:string;
  bodyParagraph1:string;
  bodyParagraph2:string;
  bodyParagraph3:string;
  storeLink:string;
  closingQuote:string;
  signature:string;
  files:FileItem[];
  price:string;
  gameInfoTitle:string;
  gameInfoDescription:string;
  gameDetails:GameDetails;
  screenshots:Media[];
  videos:Media[];
  bgImage:Media|null;
  gameTitleImage:Media|null;
}