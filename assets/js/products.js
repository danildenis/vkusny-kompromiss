// Каталог. Цены и описания взяты из канала t.me/vkusmiss.
// Для Лимона, Жвачки, Малины и Попкорна описаний в канале нет — тексты-заготовки, уточнить у Елены.
// КБЖУ — ориентировочные значения на 100 г, уточнить у Елены.

export const PRODUCTS = [
  {
    id: 'pistachio', name: 'Фисташка', price: 500, tags: ['nuts'], tint: '#E7EDD3', accent: '#7E9A45',
    short: 'Деликатная и запоминающаяся',
    desc: 'Ароматный фисташковый кекс, сливочный фисташковый крем и хрустящая крошка. Не слишком сладкий, с благородной ореховой нотой.',
    facts: ['Натуральный вкус фисташки без ароматизаторов', 'Приятный хруст в каждом кусочке', 'Утончённый дизайн и большая порция'],
    kbju: { k: 390, b: 7.2, j: 25, u: 34 },
    three: { shape: 'pistachio', style: 'clam', roll: -PI2(.56), tilt: .32, sheen: '#f3ffd8',
      layers: [
        { type: 'shell', color: '#D5DEAE', label: 'Тонкий корпус' },
        { type: 'cream', color: '#D2DA9C', label: 'Сливочный фисташковый крем' },
        { type: 'crumble', color: '#BDAE6C', accent: '#8AA14A', label: 'Хрустящая крошка' },
        { type: 'sponge', color: '#A3B05E', label: 'Ароматный фисташковый кекс' },
      ] },
  },
  {
    id: 'mango', name: 'Манго', price: 400, tags: ['fruit'], tint: '#FCE9C4', accent: '#E9932A',
    short: 'Тропическое лето в одном десерте',
    desc: 'Сочный, яркий, с кусочками свежего манго. Лёгкий фруктовый мусс и мягкая текучая начинка — идеальный баланс текстур.',
    facts: ['Свежие кусочки спелого манго', 'Освежающий вариант для жаркого дня', 'Реалистичный вид — идеально для фото и сюрпризов'],
    kbju: { k: 245, b: 3.1, j: 12.8, u: 29.6 },
    three: { shape: 'mango', style: 'book', roll: -1.05, explodeRoll: .95, tilt: .12, sheen: '#fff0c4',
      layers: [
        { type: 'shell', color: '#F2D58E', label: 'Тонкий корпус' },
        { type: 'mousse', color: '#F5C152', label: 'Лёгкий фруктовый мусс' },
        { type: 'confit', color: '#EE8A12', accent: '#FFC23A', chunks: true, label: 'Текучая начинка с кусочками манго' },
      ] },
  },
  {
    id: 'blueberry', name: 'Черника', price: 400, tags: ['berry'], tint: '#E2E4F2', accent: '#3F4C86',
    short: 'Ягодное трио в одном десерте',
    desc: 'Чёрная смородина, черника и голубика создают необыкновенный вкус. С лёгкой кислинкой, освежающий и очень летний.',
    facts: ['Яркий ягодный вкус, ягоды голубики', 'Баланс сладости и лёгкой кислинки', 'Воздушный мусс, ягодный центр и хрустящий корпус'],
    kbju: { k: 230, b: 3, j: 12, u: 28 },
    three: { shape: 'blueberry', style: 'clam', tilt: .38, sheen: '#c9d2ff',
      layers: [
        { type: 'shell', color: '#3B3B66', label: 'Хрустящий тонкий корпус' },
        { type: 'mousse', color: '#CDBBDD', label: 'Нежный воздушный мусс' },
        { type: 'confit', color: '#4E1C4A', accent: '#2E3570', berries: true, seeds: true, seedColor: '#1a0716', label: 'Ягодный центр: черника, голубика, смородина' },
      ] },
  },
  {
    id: 'coffee', name: 'Кофейное зерно', price: 300, tags: ['nuts'], tint: '#EBDCCF', accent: '#7A4A30',
    short: 'Если цените глубину вкуса',
    desc: 'Насыщенный шоколадный кекс, нежный кофейный крем, хрустящий крамбл и лёгкая нотка сливок. Каждый кусочек — идеальный кофе-брейк, только вкуснее.',
    facts: ['Для любителей кофе и шоколада', 'Для уютного вечера с книгой', 'Подарок коллеге, который не может без эспрессо'],
    kbju: { k: 360, b: 5, j: 22, u: 35 },
    three: { shape: 'coffee', style: 'book', roll: -.35, tilt: .1, finish: 'gloss',
      layers: [
        { type: 'shell', color: '#5A3524', label: 'Шоколадный корпус' },
        { type: 'cream', color: '#C49C74', label: 'Нежный кофейный крем' },
        { type: 'crumble', color: '#946238', accent: '#5E3A22', label: 'Хрустящий крамбл' },
        { type: 'sponge', color: '#4D2C20', label: 'Насыщенный шоколадный кекс' },
      ] },
  },
  {
    id: 'raspberry', name: 'Малина', price: 300, tags: ['berry'], tint: '#F9DEE4', accent: '#C23A5E',
    short: 'Ягодная классика',
    desc: 'Нежный сливочный мусс и яркое малиновое конфи с лёгкой кислинкой.',
    facts: ['Яркий ягодный вкус', 'Нежный сливочный мусс', 'Выглядит как настоящая ягода'],
    kbju: { k: 240, b: 3, j: 13, u: 28 },
    three: { shape: 'raspberry', style: 'clam', tilt: .3, sheen: '#ffd0dc',
      layers: [
        { type: 'shell', color: '#F0C3CF', label: 'Тонкий корпус' },
        { type: 'mousse', color: '#F8DCE2', label: 'Сливочный мусс' },
        { type: 'confit', color: '#B81D45', accent: '#E0466C', seeds: true, seedColor: '#5c0a1e', label: 'Малиновое конфи' },
      ] },
  },
  {
    id: 'banana', name: 'Банан', price: 200, tags: ['fruit'], tint: '#FBF0C6', accent: '#C9962A',
    short: 'Нежность, у которой есть характер',
    desc: 'Сливочный крем, банановая карамель и кусочки карамелизированного банана. Любимая классика — и для взрослых, и для детей.',
    facts: ['Для фанатов банановых и сливочных вкусов', 'Привычные вкусные сочетания', 'Милый подарок ребёнку'],
    kbju: { k: 290, b: 3.5, j: 16, u: 33 },
    three: { shape: 'banana', style: 'book', roll: PI2(.5) + .25, tilt: .12, sheen: '#fff6c8',
      layers: [
        { type: 'shell', color: '#F2E5B8', label: 'Тонкий корпус' },
        { type: 'cream', color: '#F7EFDA', label: 'Сливочный крем' },
        { type: 'caramel', color: '#D28A28', label: 'Банановая карамель' },
        { type: 'confit', color: '#E8BE5E', accent: '#F6D98A', chunks: true, label: 'Карамелизированный банан' },
      ] },
  },
  {
    id: 'lemon', name: 'Лимон', price: 200, tags: ['fruit'], tint: '#FBF4CB', accent: '#D9B622',
    short: 'Свежесть с кислинкой',
    desc: 'Сливочный мусс, яркий лимонный курд и мягкий бисквит.',
    facts: ['Освежающая кислинка', 'Нежный сливочный мусс', 'Реалистичный вид'],
    kbju: { k: 270, b: 3.5, j: 15, u: 31 },
    three: { shape: 'lemon', style: 'clam', roll: -PI2(.5), tilt: .35, sheen: '#fffbd0',
      layers: [
        { type: 'shell', color: '#F5EAB3', label: 'Тонкий корпус' },
        { type: 'mousse', color: '#FBF2CF', label: 'Сливочный мусс' },
        { type: 'confit', color: '#F2C62B', accent: '#FFE27A', label: 'Лимонный курд' },
        { type: 'sponge', color: '#EDD49B', label: 'Мягкий бисквит' },
      ] },
  },
  {
    id: 'gum', name: 'Жвачка', price: 200, tags: ['fun'], tint: '#FBE1EC', accent: '#E0679A',
    short: 'Вкус из детства',
    desc: 'Мусс со вкусом бабл-гам и ягодное желе внутри.',
    facts: ['Тот самый вкус жвачки', 'Яркий и весёлый', 'Понравится детям'],
    kbju: { k: 260, b: 3, j: 14, u: 31 },
    three: { shape: 'gum', style: 'clam', tilt: .3, finish: 'gloss',
      layers: [
        { type: 'shell', color: '#F7CFE0', label: 'Тонкий корпус' },
        { type: 'mousse', color: '#F6BAD3', label: 'Мусс бабл-гам' },
        { type: 'confit', color: '#7FCBE3', accent: '#B8E6F4', label: 'Ягодное желе' },
      ] },
  },
  {
    id: 'popcorn', name: 'Попкорн', price: 200, tags: ['fun'], tint: '#F6EEDB', accent: '#C98A35',
    short: 'Как в кино, только вкуснее',
    desc: 'Карамельный мусс, солёная карамель и хрустящий слой с попкорном.',
    facts: ['Сладко-солёный баланс', 'Хруст внутри', 'Для вечера с фильмом'],
    kbju: { k: 330, b: 4, j: 18, u: 38 },
    three: { shape: 'popcorn', style: 'clam', tilt: .3, sheen: '#fffaf0',
      layers: [
        { type: 'shell', color: '#F3E6C8', label: 'Тонкий корпус' },
        { type: 'mousse', color: '#EBCB93', label: 'Карамельный мусс' },
        { type: 'caramel', color: '#B9671F', label: 'Солёная карамель' },
        { type: 'crumble', color: '#F1DFAE', accent: '#D9A54B', label: 'Хрустящий попкорн' },
      ] },
  },
];

function PI2(f) { return Math.PI * f; }

export const byId = id => PRODUCTS.find(p => p.id === id);

export const FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'fruit', label: 'Фруктовые' },
  { id: 'berry', label: 'Ягодные' },
  { id: 'nuts', label: 'Орехи и кофе' },
  { id: 'fun', label: 'Необычные' },
];

export const CONTACTS = {
  primary: 'KurbatovaElen',
  secondary: 'malinovskaya_manic',
  channel: 'vkusmiss',
};

export const rub = n => n.toLocaleString('ru-RU') + ' ₽';
