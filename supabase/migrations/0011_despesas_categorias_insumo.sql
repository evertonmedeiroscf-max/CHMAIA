-- Mantém as categorias existentes e adiciona categorias pessoais + insumo
-- por tipo (espelhando as categorias de Estoque, para facilitar cruzar
-- despesa de insumo com o estoque correspondente).
alter table despesas drop constraint despesas_categoria_check;
alter table despesas add constraint despesas_categoria_check check (
  categoria in (
    'Insumos/Compras',
    'Mão de obra',
    'Transporte',
    'Aluguel/Equipamento',
    'Outras despesas',
    'Despesas pessoais',
    'Insumo Frios e Laticínios',
    'Insumo Bebidas',
    'Insumo Mercearia',
    'Insumo Hortifruti',
    'Insumo Proteínas',
    'Insumo Embalagens',
    'Insumo Limpeza'
  )
);
