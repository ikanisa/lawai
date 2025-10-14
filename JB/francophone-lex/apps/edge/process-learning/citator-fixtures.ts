export type TreatmentKind =
  | 'followed'
  | 'applied'
  | 'affirmed'
  | 'distinguished'
  | 'criticized'
  | 'negative'
  | 'overruled'
  | 'vacated'
  | 'pending_appeal'
  | 'questioned'
  | 'unknown';

export interface CitatorFixture {
  jurisdiction: string;
  citedUrl: string;
  citingUrl: string;
  treatment: TreatmentKind;
  weight?: number;
  decidedAt?: string;
}

export const CITATOR_FIXTURES: CitatorFixture[] = [
  {
    jurisdiction: 'CA',
    citedUrl: 'https://scc-csc.lexum.com/scc-csc/fr/item/16057/index.do',
    citingUrl: 'https://canlii.ca/t/hz3b8',
    treatment: 'followed',
    weight: 1.15,
    decidedAt: '2019-03-13',
  },
  {
    jurisdiction: 'BE',
    citedUrl: 'https://www.courdecassation.fr/decision/58fc23dd302bf94d3f8b45c6',
    citingUrl: 'https://www.courdecassation.be/id/20200904C190375F',
    treatment: 'distinguished',
    weight: 0.75,
    decidedAt: '2020-09-04',
  },
  {
    jurisdiction: 'CH',
    citedUrl: 'https://www.courdecassation.be/id/20200904C190375F',
    citingUrl:
      'https://www.bger.ch/ext/eurospider/live/fr/php/aza/http/index.php?highlight_docid=aza://aza://04-11-2019-4A_138-2019-fr',
    treatment: 'criticized',
    weight: 0.6,
    decidedAt: '2019-11-04',
  },
  {
    jurisdiction: 'OHADA',
    citedUrl: 'https://www.courdecassation.fr/decision/58fc23dd302bf94d3f8b45c6',
    citingUrl: 'https://www.ohada.org/index.php/fr/ccja/jurisprudence/article/2741',
    treatment: 'affirmed',
    weight: 1.05,
    decidedAt: '2022-06-23',
  },
];
