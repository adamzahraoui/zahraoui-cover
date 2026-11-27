export const topics = ['Toutes', 'Informations générales', 'Demandes de devis', 'Contrats d’assurance', 'Assistance', 'Particuliers', 'Professionnels'] as const

export const faqs = [
  {
    topic: topics[1],
    question: 'Quel est le rôle d’un courtier en assurances ?',
    answer: 'Un courtier vous aide à préciser vos besoins, à étudier les solutions disponibles et à comprendre les conditions proposées par les assureurs.',
  },
  {
    topic: topics[2],
    question: 'Dois-je créer un compte pour demander un devis ?',
    answer: 'La demande de devis est accessible sans compte. Vous pouvez indiquer votre besoin et vos coordonnées pour être recontacté lorsque le service est disponible.',
  },
  {
    topic: topics[3],
    question: 'Comment sont définies les garanties d’un contrat ?',
    answer: 'Les garanties, exclusions et conditions applicables figurent dans les documents de l’assureur. Elles varient selon la couverture choisie.',
  },
  {
    topic: topics[4],
    question: 'Quel numéro appeler pour l’assistance ?',
    answer: 'Utilisez le numéro officiel du service d’assistance indiqué dans l’en-tête et sur la page Assistance.',
  },
  {
    topic: topics[5],
    question: 'Quelles assurances proposez-vous aux particuliers ?',
    answer: 'Le catalogue présente notamment les catégories automobile, habitation, santé et voyage. Un conseiller vous aide à orienter votre demande.',
  },
  {
    topic: topics[6],
    question: 'Accompagnez-vous les PME et indépendants ?',
    answer: 'L’espace Professionnels présente les possibilités d’accompagnement pour les entreprises et indépendants.',
  },
]
