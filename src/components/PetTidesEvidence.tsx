import type { Article } from '../lib/pettides';

export function PetTidesArticleBody({ article }: { article: Pick<Article, 'body' | 'sources'> }) {
 return <>{article.body.split('\n\n').map((paragraph,i)=><p key={i}>{paragraph.split(/(\[\d+\])/g).map((part,j)=>{
  const match=part.match(/^\[(\d+)\]$/);const source=match?article.sources[Number(match[1])-1]:undefined;
  return source?.startsWith('https://')?<a key={j} href={source} target="_blank" rel="noreferrer" aria-label={`Original research source ${match![1]}`}>{part}</a>:part;
 })}</p>)}</>;
}
export default function PetTidesEvidence({ article }: { article: Article }) {
 if(article.status!=='published')return null;
 return <section className="pt-evidence" aria-label="Product benefits and evidence"><div className="pt-eyebrow">RESEARCH IN CONTEXT</div><h2>Potential benefits & evidence</h2><p className="pt-evidence-status">Published education · {article.title}</p><PetTidesArticleBody article={article} /><p>Educational information only. Not veterinary advice or a recommendation to use this product.</p></section>;
}
