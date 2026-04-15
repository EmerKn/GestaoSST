INSERT INTO produtos_quimicos (
  trade_name,
  product_name,
  chemical_composition,
  required_ppe,
  pictograms,
  fispq_url,
  sectors,
  roles
) VALUES (
  '407',
  'Adesivo de contato',
  'Adesivo de contato à base de borrachas e resinas sintéticas, aditivos e solventes orgânicos. Ingredientes: Segredo industrial 1 (20-40%), Tolueno (5-20%), Acetona (5-20%).',
  'Óculos de proteção, sapatos fechados, vestimenta de proteção adequada, creme de proteção para as mãos, luvas de proteção adequadas, máscara de proteção com filtro contra vapores e névoas.',
  ARRAY['Inflamável', 'Irritante', 'Perigo à saúde'],
  NULL,
  ARRAY['Produção', 'Manutenção'],
  ARRAY['Operador', 'Mecânico']
);
