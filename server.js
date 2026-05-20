'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

// ============================================================
// CONFIG — EDIT THESE VALUES BEFORE GOING LIVE
// ============================================================
const CONFIG = {
  nomes: 'Ana Clara & Isaque',
  dataEvento: '20 de junho de 2026',
  horaEvento: '13h00',
  endereco: 'Rua Engenheiro Francelino Mota, 417',

  // ── PIX ──────────────────────────────────────────────────────
  pixKey: '42c0a4b3-7a3d-42c4-980e-9ff9aa658e6c',
  pixNome: 'Ana Clara',                    // Nome que aparece no QR Code (máx 25 caracteres)
  pixCidade: 'Sao Paulo',                  // Sem acentos (padrão EMV)

  // ── TRANSFERÊNCIA BANCÁRIA ────────────────────────────────────
  bank: {
    banco: 'Safra (422)',
    agencia: '0288',
    conta: '24153-1',
    tipo: 'Conta Corrente',
    titular: 'Ana Clara',
    cpf: '',
  },

  // ── PAGAR.ME ──────────────────────────────────────────────────
  // Crie sua conta em pagar.me → Dashboard → Configurações → API Keys
  pagarme: {
    secretKey: '',    // sk_test_xxxxx (sandbox) ou sk_live_xxxxx (produção)
    publicKey: '',    // pk_test_xxxxx — usado no frontend (futuro)
    webhookSecret: '', // Dashboard Pagar.me → Webhooks → Criar webhook → copie o secret
  },

  // ── E-MAIL (envio do código de login de 6 dígitos) ───────────
  // Preencha o arquivo .env (modelo em .env.example) com um Gmail + senha de app.
  email: {
    user: process.env.EMAIL_USER || '',
    appPassword: process.env.EMAIL_APP_PASSWORD || '',
  },

  adminPassword: 'Isana2026@',
  port: process.env.PORT || 3000,
};
// ============================================================

const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const { createStaticPix, hasError: pixHasError } = require('pix-utils');
const nodemailer = require('nodemailer');

const app = express();
const DB_PATH = path.join(__dirname, 'data.db');

// ──────────────────────────────────────────────────────────────
// ITEMS DATA
// ──────────────────────────────────────────────────────────────
const ITEMS = [
  {id:1, cat:'Cozinha', name:'Churrascou', desc:'Kit de churrasco com 25 peças em aço inox: 1 tábua de corte, 1 faca do chef, 1 garfo trinchante, 1 pegador longo, 1 espátula, 1 abridor de garrafa, 1 amolador, 6 garfos, 6 facas e 6 mini pegadores de carne. Pra nunca faltar uma carne sangrando na vida do casal — e pro Isaque assumir de vez o posto de churrasqueiro oficial!', price:99.9, image:'/img/itens/1.jpg', emoji:'🥩'},
  {id:2, cat:'Mesa', name:'6 copos cinza Serena', desc:'Conjunto de 6 copos Serena na cor cinza. Pra água, suco ou aquele refri geladinho de domingo — combinam com qualquer mesa e com qualquer visita que aparecer de surpresa.', price:59.9, image:'/img/itens/2.jpg', emoji:'🥃'},
  {id:3, cat:'Mesa', name:'6 taças de vinho 520ml', desc:'Conjunto de 6 taças de cristal para vinho, capacidade de 520ml. Para aquele dia que os noivos precisam relaxar ou receber uns amigos para um bom vinho.', price:99.9, image:'/img/itens/3.jpg', emoji:'🍾'},
  {id:4, cat:'Mesa', name:'6 taças de vinho 460ml', desc:'Conjunto de 6 taças de cristal para vinho, capacidade de 460ml. Seis nunca é demais: enquanto um jogo descansa na pia, o outro já está na mesa pro próximo brinde.', price:69.9, image:'/img/itens/4.jpg', emoji:'🍷'},
  {id:5, cat:'Mesa', name:'6 taças de gin 600ml', desc:'Conjunto de 6 taças para gin, capacidade de 600ml. Para a noiva fazer drinks com ingredientes malucos e dar pro noivo provar. Adquirindo esse produto, a noiva fica te devendo um drink experimento.', price:69.9, image:'/img/itens/5.jpg', emoji:'🍹'},
  {id:6, cat:'Mesa', name:'6 taças de chopp 385ml', desc:'Conjunto de 6 taças para chopp, capacidade de 385ml. Pra receber a galera, ver o jogo e fingir que o chopp de casa é igualzinho ao do bar (spoiler: fica até melhor).', price:49.9, image:'/img/itens/6.jpg', emoji:'🍺'},
  {id:7, cat:'Mesa', name:'6 taças de champanhe 210ml', desc:'Conjunto de 6 taças de cristal para champanhe, capacidade de 210ml. Reservadas pros grandes momentos: o sim, o primeiro ano de casados e toda desculpa boa pra comemorar.', price:109.9, image:'/img/itens/7.jpg', emoji:'🥂'},
  {id:8, cat:'Mesa', name:'6 taças bubble 300ml', desc:'Conjunto de 6 taças bubble com base em esfera, capacidade de 300ml. Lindas demais pra ficar guardadas no armário — vão deixar qualquer drink com cara de capa de revista.', price:199.9, image:'/img/itens/8.jpg', emoji:'🫧'},
  {id:9, cat:'Organização', name:'5 potes herméticos 370ml #1', desc:'Conjunto de 5 potes herméticos de vidro, capacidade de 370ml. Tamanho perfeito pra temperos e sementinhas — e pra Ana Clara finalmente organizar aquela gaveta da bagunça.', price:49.9, image:'/img/itens/9.jpg', emoji:'🫙'},
  {id:10, cat:'Organização', name:'5 potes herméticos 370ml #2', desc:'Conjunto de 5 potes herméticos de vidro, capacidade de 370ml. Cinco nunca bastam: esses garantem que nenhum grão de café ou pacotinho aberto fique perdido pela cozinha.', price:49.9, image:'/img/itens/10.jpg', emoji:'🫙'},
  {id:11, cat:'Organização', name:'5 potes herméticos 640ml #1', desc:'Conjunto de 5 potes herméticos de vidro, capacidade de 640ml. Para o noivo levar o almoço para o trabalho e lembrar que tem uma noiva que o ama muito em casa.', price:49.9, image:'/img/itens/11.jpg', emoji:'🫙'},
  {id:12, cat:'Organização', name:'5 potes herméticos 640ml #2', desc:'Conjunto de 5 potes herméticos de vidro, capacidade de 640ml. Ideais pra marmita da semana — pra cada vez que o Isaque abrir um pote no trabalho lembrar que a Ana Clara está torcendo por ele em casa.', price:49.9, image:'/img/itens/12.jpg', emoji:'🫙'},
  {id:13, cat:'Organização', name:'3 potes herméticos 1040ml #1', desc:'Conjunto de 3 potes herméticos de vidro, capacidade de 1040ml. Para guardar aquele jantar dos deuses feito pelas vovozinhas. Créditos para as ótimas cozinheiras Regina e Djanira.', price:49.9, image:'/img/itens/13.jpg', emoji:'🫙'},
  {id:14, cat:'Organização', name:'3 potes herméticos 1040ml #2', desc:'Conjunto de 3 potes herméticos de vidro, capacidade de 1040ml. Os grandões da cozinha: cabe sopa, feijão e aquela receita de família que a vovó Regina e a vovó Djanira fazem como ninguém.', price:49.9, image:'/img/itens/14.jpg', emoji:'🫙'},
  {id:15, cat:'Organização', name:'5 potes herméticos mantimentos #1', desc:'Conjunto de 5 potes herméticos para mantimentos. Arroz, feijão, açúcar e farinha — cada um no seu lugar, porque despensa organizada é meio caminho andado pro jantar sair perfeito.', price:79.9, image:'/img/itens/15.jpg', emoji:'🫙'},
  {id:16, cat:'Organização', name:'5 potes herméticos mantimentos #2', desc:'Conjunto de 5 potes herméticos para mantimentos. Pra fechar a despensa dos sonhos: tudo fresquinho e aquela satisfação de abrir o armário e ver tudo no lugar.', price:79.9, image:'/img/itens/16.jpg', emoji:'🫙'},
  {id:17, cat:'Cozinha', name:'3 assadeiras de vidro #1', desc:'Conjunto de 3 assadeiras de vidro refratário. Do forno direto pra mesa: lasanha, frango assado e aquele domingo em família que ninguém quer que acabe.', price:79.9, image:'/img/itens/17.jpg', emoji:'🥘'},
  {id:18, cat:'Cozinha', name:'3 assadeiras de vidro #2', desc:'Conjunto de 3 assadeiras de vidro refratário. Três tamanhos pra nunca faltar espaço quando a casa encher de gente com fome.', price:79.9, image:'/img/itens/18.jpg', emoji:'🥘'},
  {id:19, cat:'Cozinha', name:'Biscoito perfeito', desc:'Contém 1 assadeira retangular de biscoito antiaderente de 38 × 26 × 2 cm e 1 assadeira retangular de biscoito antiaderente de 43 × 28 × 2 cm. Pra Ana Clara assar aquela leva de biscoitos que some da lata antes mesmo de esfriar.', price:89.9, image:'/img/itens/19.jpg', emoji:'🍪'},
  {id:20, cat:'Cozinha', name:'Muffins dos Deuses', desc:'Contém 1 forma de cupcake de 12 cavidades e 1 forma de mini cupcake de 24 cavidades. Trinta e seis muffins de uma vez: um pro café, um pra sobremesa e o resto pra dividir com quem merece.', price:79.9, image:'/img/itens/20.jpg', emoji:'🧁'},
  {id:21, cat:'Cozinha', name:'Vai um empadão?', desc:'Contém 1 assadeira retangular de 44,5 × 30,5 × 5,4 cm e 1 forma de bolo retangular de 22 × 27 × 5 cm. Pro empadão de domingo, a lasanha da família e tudo que pede aquele tamanho família.', price:79.9, image:'/img/itens/21.jpg', emoji:'🥧'},
  {id:22, cat:'Cozinha', name:'Bolos de fim de tarde', desc:'Contém 2 assadeiras redondas de 26 × 4 cm. Pro bolo simples que acompanha o cafezinho das cinco — a melhor desculpa pra parar tudo e relaxar.', price:69.9, image:'/img/itens/22.jpg', emoji:'🍰'},
  {id:23, cat:'Cozinha', name:'Um lanche diferente', desc:'Contém 1 forma de pizza antiaderente de 36 cm e 1 forma de pão de 30 × 15 × 6 cm. Pizza caseira na sexta e pão fresquinho no fim de semana — a casa vira a padaria preferida do casal.', price:59.9, image:'/img/itens/23.jpg', emoji:'🍕'},
  {id:24, cat:'Cozinha', name:'Fada confeiteira', desc:'Contém 1 forma de pudim de 22 × 9 cm, kit de 3 formas de fundo falso de 15 × 5 cm e 1 forma de quiché redonda de 24 cm com fundo removível. Pra Ana Clara soltar a fada confeiteira que mora nela e arrasar nas tortas, quiches e pudins.', price:79.9, image:'/img/itens/24.jpg', emoji:'🧚'},
  {id:25, cat:'Cozinha', name:'3 bowl de inox', desc:'Conjunto de 3 bowls de inox. Pra bater bolo, descansar a massa ou misturar a salada — leves, resistentes e impossíveis de quebrar.', price:59.9, image:'/img/itens/25.jpg', emoji:'🥣'},
  {id:26, cat:'Mesa', name:'Bandeja para frios com tampa', desc:'Bandeja para servir frios, com tampa. Queijos, presunto e uvas dispostos com capricho: a estrela das tardes de vinho e conversa boa.', price:99.9, image:'/img/itens/26.jpg', emoji:'🧀'},
  {id:27, cat:'Cozinha', name:'Caixa de chá', desc:'Caixa organizadora para chás. Pra cada sabor ter seu cantinho e a Ana Clara escolher entre camomila e hortelã naquela noite de relaxar.', price:59.9, image:'/img/itens/27.jpg', emoji:'☕'},
  {id:28, cat:'Cozinha', name:'Frigideira 28cm', desc:'Frigideira antiaderente de 28cm. Tamanhão pra refogar, fritar e selar sem nada grudar — do ovo da manhã ao jantar mais caprichado.', price:59.9, image:'/img/itens/28.jpg', emoji:'🍳'},
  {id:29, cat:'Cozinha', name:'Garrafa de óleo + Moedor duplo + Jarra medidora', desc:'Trio que toda cozinha pede: garrafa dosadora de óleo (azeite na medida certa, sem exagero), moedor duplo de sal e pimenta na hora e jarra medidora de vidro de 1L. Praticidade e sabor em cada receita.', price:79.9, image:'/img/itens/29.jpg', emoji:'🫒'},
  {id:30, cat:'Cozinha', name:'Chato pra comer', desc:'Kit de 4 peças: escorredor de arroz, escorredor de macarrão, escorredor telado e 3 peneiras. Feito sob medida pro Isaque, que é chato pra comer e jura que não bebe suco que não seja bem coado — agora não sobra nem um carocinho pra ele reclamar!', price:69.9, image:'/img/itens/30.jpg', emoji:'🥣'},
  {id:31, cat:'Cozinha', name:'4 Facas de Cerâmica + descascador', desc:'Conjunto de 4 facas de cerâmica afiadíssimas + 1 descascador. Cortam tomate, carne e até a paciência de quem ainda usa faca cega — cozinhar vira sofisticação.', price:119.9, image:'/img/itens/31.jpg', emoji:'🔪'},
  {id:32, cat:'Cozinha', name:'Noite Romântica', desc:'Plaina para queijo, ralador de queijo e abridor de vinho elétrico. Tudo pronto pra uma noite romântica do casal: luz baixa, tábua de frios caprichada e o vinho abrindo sozinho.', price:89.9, image:'/img/itens/32.jpg', emoji:'🧀'},
  {id:33, cat:'Cozinha', name:'Abridor de latas + funis + cortador de pizza', desc:'Abridor de latas manual inox 3 em 1, kit de 3 funis (grande, médio e pequeno) e cortador/pegador de pizza. Os heróis discretos da cozinha — daqueles que só notamos a falta na hora do aperto.', price:59.9, image:'/img/itens/33.jpg', emoji:'🥫'},
  {id:34, cat:'Cozinha', name:'Kit Chef de Cozinha', desc:'Kit de utensílios de cozinha (com tesoura e faca) + kit de 12 potes porta-tempero de vidro. Pra Ana Clara e Isaque cozinharem como chefs de verdade: temperos sempre à mão e tudo no lugar.', price:129.9, image:'/img/itens/34.jpg', emoji:'🥄'},
  {id:35, cat:'Mesa', name:'Kit de drinks', desc:'Kit completo para preparo de drinks, com coqueteleira e acessórios. Pra transformar a sexta-feira em happy hour particular — o bar agora é em casa.', price:59.9, image:'/img/itens/35.jpg', emoji:'🍸'},
  {id:36, cat:'Organização', name:'3 Kit lavanderia', desc:'Conjunto de 3 kits para lavanderia, com potes dosadores. Sabão, amaciante e tudo organizado: até a lavanderia merece ficar bonita e cheirosa.', price:59.9, image:'/img/itens/36.jpg', emoji:'🧺'},
  {id:37, cat:'Mesa', name:'Aparelho de jantar Bio Latte 24 peças', desc:'Aparelho de jantar linha Bio Latte — 24 peças. Pra receber bem, do almoço de domingo ao jantar que vira história pra contar.', price:200.0, image:'/img/itens/37.jpg', emoji:'🍽️'},
  {id:38, cat:'Mesa', name:'Aparelho de jantar Bio Latte 25 peças', desc:'Aparelho de jantar linha Bio Latte — 25 peças. Louça nova, casa nova, vida nova: a mesa posta que o casal vai usar por muitos e muitos anos.', price:200.0, image:'/img/itens/38.jpg', emoji:'🍽️'},
  {id:39, cat:'Mesa', name:'Aparelho de jantar 24 peças #1', desc:'Aparelho de jantar — 24 peças. Porque toda refeição em família fica melhor servida em pratos bonitos.', price:200.0, image:'/img/itens/39.jpg', emoji:'🍽️'},
  {id:40, cat:'Mesa', name:'Aparelho de jantar 24 peças #2', desc:'Aparelho de jantar — 24 peças. Um segundo jogo pra nunca faltar prato quando a casa encher de gente — e ela vai encher!', price:200.0, image:'/img/itens/40.jpg', emoji:'🍽️'},
  {id:41, cat:'Cozinha', name:'Jogo de 4 Panelas Tramontina Brava', desc:'Jogo de 4 panelas Tramontina, linha Brava, com revestimento antiaderente. O coração da cozinha: nelas vão nascer os primeiros (e os melhores) jantares do casal.', price:200.0, image:'/img/itens/41.jpg', emoji:'🥘'},
  {id:42, cat:'Cozinha', name:'Panela elétrica', desc:'Panela de pressão elétrica. Feijão, carne e cozido prontos num apertar de botão — pros dias corridos em que a fome chega antes da hora.', price:200.0, image:'/img/itens/42.jpg', emoji:'⚡'},
  {id:43, cat:'Cozinha', name:'Liquidificador Electrolux', desc:'Liquidificador Electrolux. Vitamina de manhã, suco no almoço e aquele molho caprichado no jantar — potente e pra vida toda.', price:189.9, image:'/img/itens/43.jpg', emoji:'🥤'},
  {id:44, cat:'Cozinha', name:'Multiprocessador Philco 5x1', desc:'Multiprocessador de alimentos Philco 5 em 1. Pica, rala, fatia e bate: faz o trabalho de cinco e ainda deixa a Ana Clara com tempo de sobra.', price:200.0, image:'/img/itens/44.jpg', emoji:'⚙️'},
  {id:45, cat:'Cozinha', name:'Mixer', desc:'Mixer / processador de mão. Pra um molho cremoso, uma sopa aveludada ou um purê de dar orgulho — direto na panela, sem sujeira.', price:179.9, image:'/img/itens/45.jpg', emoji:'🥄'},
  {id:46, cat:'Cozinha', name:'Air Fryer', desc:'Fritadeira elétrica sem óleo (Air Fryer). A queridinha que não pode faltar: crocante por fora, macia por dentro e aquela batatinha sem peso na consciência.', price:200.0, image:'/img/itens/46.jpg', emoji:'🌬️'},
  {id:47, cat:'Cama', name:'Jogo de lençol queen (branco) #1', desc:'Jogo de lençol queen na cor branca. Pra cama do casal ser sempre aquele convite irresistível de fim de dia.', price:200.0, image:'/img/itens/47.jpg', emoji:'🛏️'},
  {id:48, cat:'Cama', name:'Jogo de lençol queen (branco) #2', desc:'Jogo de lençol queen na cor branca. Um segundo jogo pra nunca faltar lençol limpo enquanto o outro está na lavanderia.', price:200.0, image:'/img/itens/48.jpg', emoji:'🛏️'},
  {id:49, cat:'Cama', name:'Jogo de lençol queen (bege) #1', desc:'Jogo de lençol queen na cor bege. Aconchego em tom neutro pra noites de sono pesado e manhãs preguiçosas de domingo.', price:200.0, image:'/img/itens/49.jpg', emoji:'🛏️'},
  {id:50, cat:'Cama', name:'Jogo de lençol queen (bege) #2', desc:'Jogo de lençol queen na cor bege. Porque cama arrumada com lençol macio é o melhor jeito de terminar (e começar) o dia.', price:200.0, image:'/img/itens/50.jpg', emoji:'🛏️'},
  {id:51, cat:'Cama', name:'Kit cama posta (azul)', desc:'Kit de cama posta na cor azul. Cama feita com capricho, do jeitinho de hotel — só que com o aconchego de lar.', price:200.0, image:'/img/itens/51.jpg', emoji:'🛌'},
  {id:52, cat:'Cama', name:'Kit cama posta (Lisboa)', desc:'Kit de cama posta modelo Lisboa. Estilo e charme pra transformar o quarto no cantinho preferido da casa.', price:200.0, image:'/img/itens/52.jpg', emoji:'🛌'},
  {id:53, cat:'Cama', name:'Cobre leito (rosa)', desc:'Cobre-leito de casal na cor rosa. Um toque de delicadeza pra deixar a cama linda e o friozinho do lado de fora.', price:79.9, image:'/img/itens/53.jpg', emoji:'🛏️'},
  {id:54, cat:'Cama', name:'Cobre leito (azul escuro)', desc:'Cobre-leito de casal na cor azul escuro. Elegante e quentinho — perfeito pras noites de cinema embaixo das cobertas.', price:79.9, image:'/img/itens/54.jpg', emoji:'🛏️'},
  {id:55, cat:'Mesa', name:'Bowls m&m\'s', desc:'Conjunto de 4 tigelas de cerâmica do m&m\'s, coloridas e divertidas. Perfeitas pra sorvete, sobremesa ou aquele açaí de fim de tarde — cada um escolhe a sua cor.', price:89.9, image:'/img/itens/55.jpg', emoji:'🥣'},
  {id:56, cat:'Banho', name:'Jogo de toalha bordada branca (Ana Clara e Isana)', desc:'Contém 1 toalha de banho bordada com o nome da noiva e 1 toalha de rosto bordada com o apelido do casal, Isana. Bordado feito com carinho pra dar as boas-vindas ao novo lar.', price:150.0, image:'/img/itens/56.jpg', emoji:'🌸'},
  {id:57, cat:'Banho', name:'Jogo de toalha bordada branca (Isaque e Família)', desc:'Contém 1 toalha de banho bordada com o nome do noivo e 1 toalha de rosto bordada com a palavra Família. Um detalhe especial pra cada banho ter um toque de casa.', price:150.0, image:'/img/itens/57.jpg', emoji:'🌸'},
  {id:58, cat:'Banho', name:'Jogo de toalha bordada amarela (Ana Clara e Isana)', desc:'Contém 1 toalha de banho bordada com o nome da noiva e 1 toalha de rosto bordada com o apelido do casal, Isana. Amarelinha pra alegrar o banheiro e o dia de quem usar.', price:150.0, image:'/img/itens/58.jpg', emoji:'🌼'},
  {id:59, cat:'Banho', name:'Jogo de toalha bordada amarela (Isaque e Família)', desc:'Contém 1 toalha de banho bordada com o nome do noivo e 1 toalha de rosto bordada com a palavra Família. Cor de sol pra começar o dia com o pé direito.', price:150.0, image:'/img/itens/59.jpg', emoji:'🌼'},
  {id:60, cat:'Mesa', name:'Kit mesa posta', desc:'Kit de mesa posta com 8 itens. Tudo pra montar uma mesa de revista: jogo americano, sousplat e aquele capricho que faz a visita querer ficar mais um pouco.', price:110.0, image:'/img/itens/60.jpg', emoji:'🍽️'},
  {id:61, cat:'Mesa', name:'Faqueiro 20 peças #1', desc:'Faqueiro Cambridge em aço inox, 20 peças (serve 4 pessoas). Talheres elegantes pro casal receber com estilo — a mesa de jantar vira momento especial.', price:130.0, image:'/img/itens/61.jpg', emoji:'🍴'},
  {id:62, cat:'Mesa', name:'Faqueiro 20 peças #2', desc:'Faqueiro Cambridge em aço inox, 20 peças (serve 4 pessoas). Um segundo faqueiro pra quando a mesa crescer e a família (e os amigos) aparecerem de vez.', price:130.0, image:'/img/itens/62.jpg', emoji:'🍴'},
  {id:63, cat:'Mesa', name:'Jogo de sousplat 2 peças — bege', desc:'Jogo de 2 sousplats em crochê bege, feitos à mão com fio 100% algodão. Pra uma mesa pra dois daquelas em que a comida é desculpa pra ficar conversando até tarde.', price:79.9, image:'/img/itens/63.jpg', emoji:'🍽️'},
  {id:64, cat:'Mesa', name:'Jogo de sousplat 4 peças — azul', desc:'Jogo de 4 sousplats em crochê azul claro, feitos à mão com fio 100% algodão. Pro jantar com os amigos mais íntimos — aqueles que entram em casa e já abrem a geladeira.', price:149.9, image:'/img/itens/64.jpg', emoji:'🍽️'},
  {id:65, cat:'Mesa', name:'Jogo de sousplat 6 peças', desc:'Jogo de 6 sousplats em crochê azul com detalhes em dourado, feitos à mão com fio 100% algodão. Pro almoço de família completo, com lugar pra todo mundo e ainda sobra capricho na decoração.', price:189.9, image:'/img/itens/65.jpg', emoji:'🍽️'},
  {id:66, cat:'Cozinha', name:'Kit 5 panos de prato — estampas divertidas', desc:'Kit com 5 panos de prato em algodão, com bico de crochê feito à mão e estampas divertidas (ursinho, ratinho, frutas, flores e café). Aquele detalhinho fofo que faz a cozinha parecer da vovó (no melhor sentido).', price:49.9, image:'/img/itens/66.jpg', emoji:'🧺'},
  {id:67, cat:'Banho', name:'Jogo de toalhas 2 peças — verde', desc:'Jogo de toalhas com 2 peças (1 toalha de banho + 1 toalha de rosto) em verde delicado, 100% algodão. Pro banheiro do casal ficar com cara de manhã de domingo: macio, calmo e cheirosinho.', price:109.9, image:'/img/itens/67.jpg', emoji:'🛁'},
  {id:68, cat:'Banho', name:'Jogo de toalhas 3 peças — verde', desc:'Jogo de toalhas com 3 peças (1 toalha de banho + 1 toalha de lavabo + 1 toalha de mão) em verde delicado, com bordado floral. Do banho rápido às visitas no lavabo, tudo combinando.', price:179.9, image:'/img/itens/68.jpg', emoji:'🛁'},
  {id:69, cat:'Mesa', name:'Jogo de sousplat 2 peças — azul', desc:'Jogo de 2 sousplats em crochê branco com borda azul, feitos à mão com fio 100% algodão. Pra mesa de fim de semana com aquela cara de aconchego sem perder a elegância.', price:79.9, image:'/img/itens/69.jpg', emoji:'🍽️'},
  {id:70, cat:'Mesa', name:'Jogo de sousplat 2 peças — marrom', desc:'Jogo de 2 sousplats em crochê marrom e cru, feitos à mão com fio 100% algodão. Pra deixar a mesa quentinha visualmente — combina com tudo e com qualquer humor.', price:79.9, image:'/img/itens/70.jpg', emoji:'🍽️'},
  {id:71, cat:'Mesa', name:'Jogo de sousplat 4 peças — marrom #1', desc:'Jogo de 4 sousplats em crochê marrom e cru, feitos à mão com fio 100% algodão. Pra reunião de família ou aquele jantar especial em que todo mundo cabe na mesa.', price:149.9, image:'/img/itens/71.jpg', emoji:'🍽️'},
  {id:72, cat:'Mesa', name:'Jogo de sousplat 4 peças — marrom #2', desc:'Jogo de 4 sousplats em crochê marrom e cru, feitos à mão com fio 100% algodão. Um segundo conjunto pra revezar com o #1 — sempre tem um descansando enquanto o outro está na mesa.', price:149.9, image:'/img/itens/72.jpg', emoji:'🍽️'},
  {id:73, cat:'Cozinha', name:'Kit 5 panos de prato — rosa #1', desc:'Kit com 5 panos de prato em algodão, com bico de crochê em tons rosados e estampas delicadas (frutinhas, patinho, cafezinho e florzinhas). Aquele toque fofo que dá personalidade pra cozinha.', price:49.9, image:'/img/itens/73.jpg', emoji:'🧺'},
  {id:74, cat:'Cozinha', name:'Kit 5 panos de prato — rosa #2', desc:'Kit com 5 panos de prato em algodão, com bico de crochê em tons rosados e estampas delicadas. Cinco nunca é demais — sempre dá pra revezar entre o lavar e o secar.', price:49.9, image:'/img/itens/74.jpg', emoji:'🧺'},
  {id:75, cat:'Banho', name:'Jogo de toalhas 2 peças — rosa', desc:'Jogo de toalhas com 2 peças (1 toalha de banho + 1 toalha de rosto), com bordado delicado em tons rosados e acabamento em renda. Pra deixar o banheiro com cara de SPA.', price:109.9, image:'/img/itens/75.jpg', emoji:'🛁'},
  {id:76, cat:'Banho', name:'Jogo de toalhas 2 peças — amarelo', desc:'Jogo de toalhas com 2 peças (1 toalha de banho + 1 toalha de rosto), com bordado em tons amarelados. Cor de sol pra começar o dia com bom humor.', price:109.9, image:'/img/itens/76.jpg', emoji:'🛁'},
  {id:77, cat:'Banho', name:'Jogo de toalhas 3 peças — azul', desc:'Jogo de toalhas com 3 peças (1 toalha de banho + 2 toalhas de rosto) em azul claro, com bordado floral delicado. Banho do casal com toques de azul pra dar serenidade.', price:179.9, image:'/img/itens/77.jpg', emoji:'🛁'},
];

// ──────────────────────────────────────────────────────────────
// DATABASE SETUP
// ──────────────────────────────────────────────────────────────
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, item_id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    total INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL,
    price INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reserved_items (
    item_id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    reserved_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS login_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT,
    phone TEXT,
    expires_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migrações seguras (ignora se coluna já existe)
try { db.exec("ALTER TABLE orders ADD COLUMN pagarme_order_id TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'manual'"); } catch (_) {}
try { db.exec("ALTER TABLE users ADD COLUMN phone TEXT"); } catch (_) {}

// ──────────────────────────────────────────────────────────────
// PAGAR.ME HELPER
// ──────────────────────────────────────────────────────────────
async function pagarmeRequest(method, endpoint, body) {
  const key = CONFIG.pagarme.secretKey;
  if (!key) throw new Error('Pagar.me não configurado');
  const auth = Buffer.from(key + ':').toString('base64');
  const resp = await fetch(`https://api.pagar.me/core/v5${endpoint}`, {
    method,
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.message || `Pagar.me ${resp.status}`);
  return data;
}

// ──────────────────────────────────────────────────────────────
// MIDDLEWARE
// ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: __dirname }),
  secret: 'cha-panelas-secret-k3y-2026-xYz!',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }, // 7 days
}));

app.use(express.static(path.join(__dirname, 'public')));

// ──────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────
function ok(res, data) {
  return res.json({ success: true, data });
}

function fail(res, status, error) {
  return res.status(status).json({ success: false, error });
}

function requireAuth(req, res, next) {
  if (!req.session.userId) return fail(res, 401, 'Não autenticado');
  next();
}

function requireAdmin(req, res, next) {
  if (req.query.pw !== CONFIG.adminPassword) return fail(res, 403, 'Senha incorreta');
  next();
}

// Retorna um Map item_id -> 'reserved' | 'paid' (mantém .has() e .size dos chamadores)
function getReservedSet() {
  const rows = db.prepare(`
    SELECT r.item_id, o.status
    FROM reserved_items r
    JOIN orders o ON o.id = r.order_id
  `).all();
  const map = new Map();
  for (const r of rows) map.set(r.item_id, r.status === 'paid' ? 'paid' : 'reserved');
  return map;
}

function enrichItem(item, reservedSet) {
  return {
    ...item,
    reserved: reservedSet.has(item.id),
    paid: reservedSet.get(item.id) === 'paid',
  };
}

// ── AUTENTICAÇÃO POR CÓDIGO (OTP por e-mail) ──────────────────
function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function emailConfigured() {
  return !!(CONFIG.email.user && CONFIG.email.appPassword);
}

let _mailTransport = null;
function getMailTransport() {
  if (_mailTransport) return _mailTransport;
  if (!emailConfigured()) return null;
  // SMTP genérico — funciona com Gmail (default), Zoho ou qualquer outro provedor.
  // Configure via .env: EMAIL_HOST / EMAIL_PORT / EMAIL_SECURE (opcionais).
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.EMAIL_PORT || '465', 10);
  const secure = (process.env.EMAIL_SECURE || 'true').toLowerCase() !== 'false';
  _mailTransport = nodemailer.createTransport({
    host, port, secure,
    auth: { user: CONFIG.email.user, pass: CONFIG.email.appPassword },
  });
  return _mailTransport;
}

// Envia o código por e-mail. Retorna true se enviou; false se não há e-mail
// configurado (modo teste — o código aparece no console do servidor).
async function sendLoginCodeEmail(to, code) {
  const transport = getMailTransport();
  if (!transport) {
    console.log('\n  ┌──────────────────────────────────────┐');
    console.log('  │  CÓDIGO DE LOGIN (modo teste)         │');
    console.log(`  │  ${to}`);
    console.log(`  │  >>>   ${code}   <<<`);
    console.log('  └──────────────────────────────────────┘\n');
    return false;
  }
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;background:#FDFBF8;padding:36px 28px;border-radius:14px;border:1px solid #ecdfce;">
      <h1 style="color:#3D2B1F;font-size:22px;text-align:center;margin:0 0 2px;">Chá de Panelas</h1>
      <p style="color:#9a8c7a;text-align:center;margin:0 0 24px;font-size:14px;">${CONFIG.nomes}</p>
      <p style="color:#3D2B1F;font-size:15px;line-height:1.6;">Oi! Use o código abaixo para entrar na nossa lista de presentes:</p>
      <div style="text-align:center;margin:26px 0;">
        <span style="font-size:34px;letter-spacing:8px;font-weight:bold;color:#B8860B;background:#fff;padding:16px 20px 16px 28px;border-radius:12px;border:2px dashed #D4AF37;display:inline-block;">${code}</span>
      </div>
      <p style="color:#9a8c7a;font-size:13px;text-align:center;line-height:1.6;">O código vale por 10 minutos.<br>Se não foi você que pediu, é só ignorar este e-mail. 💝</p>
    </div>`;
  await transport.sendMail({
    from: `"Chá de Panelas — ${CONFIG.nomes}" <${CONFIG.email.user}>`,
    to,
    subject: `Seu código de acesso: ${code}`,
    html,
  });
  return true;
}

// ──────────────────────────────────────────────────────────────
// ROUTES
// ──────────────────────────────────────────────────────────────

// Root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── AUTH ──────────────────────────────────────────────────────

// Gera um código, salva e envia por e-mail. Usado por register/login-request.
async function issueCode(res, { email, name, phone }) {
  // anti-spam — 1 código a cada 45s por e-mail
  const recent = db.prepare(
    "SELECT COUNT(*) AS c FROM login_codes WHERE email = ? AND created_at > datetime('now','-45 seconds')"
  ).get(email);
  if (recent.c > 0) return fail(res, 429, 'Aguarde alguns segundos antes de pedir um novo código.');

  const code = genCode();
  db.prepare(
    "INSERT INTO login_codes (email, code, name, phone, expires_at) VALUES (?, ?, ?, ?, datetime('now','+10 minutes'))"
  ).run(email, code, name || null, phone || null);
  db.prepare("DELETE FROM login_codes WHERE created_at < datetime('now','-1 day')").run();

  let sent = false;
  try {
    sent = await sendLoginCodeEmail(email, code);
  } catch (e) {
    console.error('[E-mail]', e.message);
    return fail(res, 502, 'Não conseguimos enviar o e-mail. Confira o endereço e tente de novo.');
  }

  const payload = { sent, email };
  // modo teste: sem e-mail configurado (e fora de produção), devolve o código
  if (!sent && process.env.NODE_ENV !== 'production') payload.devCode = code;
  return ok(res, payload);
}

// Cadastro — passo 1: recebe nome/e-mail/telefone e envia o código
app.post('/api/auth/register-request', async (req, res) => {
  let { name, email, phone } = req.body;
  name = (name || '').trim();
  email = (email || '').trim().toLowerCase();
  phone = (phone || '').trim();

  if (!name || !email || !phone) return fail(res, 400, 'Preencha nome, e-mail e telefone.');
  if (name.length < 3) return fail(res, 400, 'Digite seu nome completo.');
  if (!isValidEmail(email)) return fail(res, 400, 'E-mail inválido.');
  if (phone.replace(/\D/g, '').length < 10) return fail(res, 400, 'Telefone inválido. Inclua o DDD.');

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return fail(res, 409, 'Esse e-mail já tem cadastro. É só fazer login!');

  return issueCode(res, { email, name, phone });
});

// Login — passo 1: recebe o e-mail e envia o código
app.post('/api/auth/login-request', async (req, res) => {
  let { email } = req.body;
  email = (email || '').trim().toLowerCase();

  if (!isValidEmail(email)) return fail(res, 400, 'E-mail inválido.');

  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!user) return fail(res, 404, 'Não encontramos esse e-mail. Faça seu cadastro primeiro.');

  return issueCode(res, { email });
});

// Passo 2: verifica o código e entra (cria a conta no primeiro acesso)
app.post('/api/auth/verify', (req, res) => {
  let { email, code } = req.body;
  email = (email || '').trim().toLowerCase();
  code = (code || '').trim();

  if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
    return fail(res, 400, 'Código inválido.');
  }

  const row = db.prepare(
    "SELECT * FROM login_codes WHERE email = ? AND code = ? AND used = 0 AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1"
  ).get(email, code);
  if (!row) return fail(res, 400, 'Código incorreto ou expirado. Peça um novo.');

  db.prepare('UPDATE login_codes SET used = 1 WHERE id = ?').run(row.id);

  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    if (!row.name) return fail(res, 400, 'Cadastro incompleto. Refaça o cadastro.');
    const result = db.prepare(
      "INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, '')"
    ).run(row.name, email, row.phone || null);
    user = { id: result.lastInsertRowid, name: row.name, email };
  }

  req.session.userId = user.id;
  req.session.userName = user.name;
  req.session.userEmail = user.email;

  return ok(res, { id: user.id, name: user.name, email: user.email });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    return ok(res, null);
  });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) return fail(res, 401, 'Não autenticado');
  return ok(res, {
    id: req.session.userId,
    name: req.session.userName,
    email: req.session.userEmail,
  });
});

// ── PUBLIC ────────────────────────────────────────────────────

app.get('/api/config', (req, res) => {
  return ok(res, {
    nomes: CONFIG.nomes,
    dataEvento: CONFIG.dataEvento,
    horaEvento: CONFIG.horaEvento,
    endereco: CONFIG.endereco,
    pixKey: CONFIG.pixKey,
    bank: CONFIG.bank,
    cardEnabled: !!CONFIG.pagarme.secretKey,
  });
});

app.get('/api/items/stats', (req, res) => {
  const reservedSet = getReservedSet();
  const reserved = reservedSet.size;
  return ok(res, {
    total: ITEMS.length,
    available: ITEMS.length - reserved,
    reserved,
  });
});

app.get('/api/items', (req, res) => {
  const reservedSet = getReservedSet();
  return ok(res, ITEMS.map(i => enrichItem(i, reservedSet)));
});

app.get('/api/items/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = ITEMS.find(i => i.id === id);
  if (!item) return fail(res, 404, 'Item não encontrado');
  const reservedSet = getReservedSet();
  return ok(res, enrichItem(item, reservedSet));
});

// ── CART ──────────────────────────────────────────────────────

app.get('/api/cart', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT item_id FROM cart_items WHERE user_id = ?').all(req.session.userId);
  const reservedSet = getReservedSet();
  const cartItems = rows.map(r => {
    const item = ITEMS.find(i => i.id === r.item_id);
    if (!item) return null;
    return enrichItem(item, reservedSet);
  }).filter(Boolean);
  return ok(res, cartItems);
});

app.post('/api/cart', requireAuth, (req, res) => {
  const itemId = parseInt(req.body.itemId, 10);
  if (!itemId) return fail(res, 400, 'itemId inválido');

  const item = ITEMS.find(i => i.id === itemId);
  if (!item) return fail(res, 404, 'Item não encontrado');

  const reserved = db.prepare('SELECT item_id FROM reserved_items WHERE item_id = ?').get(itemId);
  if (reserved) return fail(res, 409, 'Este presente já foi reservado por outra pessoa');

  try {
    db.prepare('INSERT INTO cart_items (user_id, item_id) VALUES (?, ?)').run(req.session.userId, itemId);
    return ok(res, { itemId });
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return fail(res, 409, 'Item já está no carrinho');
    }
    throw e;
  }
});

app.delete('/api/cart/:itemId', requireAuth, (req, res) => {
  const itemId = parseInt(req.params.itemId, 10);
  db.prepare('DELETE FROM cart_items WHERE user_id = ? AND item_id = ?').run(req.session.userId, itemId);
  return ok(res, null);
});

// ── ORDERS ────────────────────────────────────────────────────

app.post('/api/orders', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const cartRows = db.prepare('SELECT item_id FROM cart_items WHERE user_id = ?').all(userId);

  if (cartRows.length === 0) return fail(res, 400, 'Carrinho vazio');

  const placeOrder = db.transaction(() => {
    // Check for conflicts
    const conflicts = [];
    for (const row of cartRows) {
      const already = db.prepare('SELECT item_id FROM reserved_items WHERE item_id = ?').get(row.item_id);
      if (already) {
        const item = ITEMS.find(i => i.id === row.item_id);
        conflicts.push(item ? item.name : `Item #${row.item_id}`);
      }
    }
    if (conflicts.length > 0) {
      return { conflict: true, names: conflicts };
    }

    const itemsData = cartRows.map(r => ITEMS.find(i => i.id === r.item_id)).filter(Boolean);
    const total = itemsData.reduce((sum, i) => sum + i.price, 0);

    const order = db.prepare('INSERT INTO orders (user_id, total) VALUES (?, ?)').run(userId, total);
    const orderId = order.lastInsertRowid;

    const insertOrderItem = db.prepare('INSERT INTO order_items (order_id, item_id, price) VALUES (?, ?, ?)');
    const insertReserved = db.prepare('INSERT INTO reserved_items (item_id, order_id) VALUES (?, ?)');

    for (const item of itemsData) {
      insertOrderItem.run(orderId, item.id, item.price);
      insertReserved.run(item.id, orderId);
    }

    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);

    return { conflict: false, orderId, total, items: itemsData };
  });

  const result = placeOrder();

  if (result.conflict) {
    return fail(res, 409, `Os seguintes itens já foram reservados: ${result.names.join(', ')}`);
  }

  return ok(res, {
    orderId: result.orderId,
    total: result.total,
    items: result.items,
    pixKey: CONFIG.pixKey,
  });
});

app.get('/api/orders/me', requireAuth, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.session.userId);
  const getItems = db.prepare('SELECT item_id, price FROM order_items WHERE order_id = ?');

  const enriched = orders.map(order => {
    const orderItems = getItems.all(order.id).map(oi => {
      const item = ITEMS.find(i => i.id === oi.item_id);
      return item ? { ...item, price: oi.price } : { id: oi.item_id, price: oi.price, name: 'Item removido' };
    });
    return { ...order, items: orderItems };
  });

  return ok(res, enriched);
});

// ── PAGAMENTO EM DINHEIRO ─────────────────────────────────────
// Marca o pedido como "vou pagar em dinheiro no dia do chá".
app.post('/api/orders/:id/cash', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .get(id, req.session.userId);
  if (!order) return fail(res, 404, 'Pedido não encontrado');
  db.prepare("UPDATE orders SET payment_method = 'dinheiro' WHERE id = ?").run(id);
  return ok(res, { orderId: id, paymentMethod: 'dinheiro' });
});

// ── PIX QR CODE ───────────────────────────────────────────────

app.get('/api/pix-qr', requireAuth, async (req, res) => {
  const orderId = parseInt(req.query.orderId, 10);
  if (!orderId) return fail(res, 400, 'orderId obrigatório');

  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .get(orderId, req.session.userId);
  if (!order) return fail(res, 404, 'Pedido não encontrado');

  // ── 1. Pagar.me (preferencial) ────────────────────────────
  if (CONFIG.pagarme.secretKey) {
    try {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
      const rows = db.prepare('SELECT item_id, price FROM order_items WHERE order_id = ?').all(orderId);
      const pgItems = rows.map(r => {
        const it = ITEMS.find(x => x.id === r.item_id);
        return { amount: r.price * 100, description: (it ? it.name : `Item #${r.item_id}`).substring(0, 64), quantity: 1, code: String(r.item_id) };
      });

      const pgOrder = await pagarmeRequest('POST', '/orders', {
        items: pgItems,
        customer: { name: user.name, email: user.email, type: 'individual' },
        payments: [{ payment_method: 'pix', pix: { expires_in: 86400 } }],
        metadata: { our_order_id: String(orderId) },
      });

      db.prepare("UPDATE orders SET pagarme_order_id = ?, payment_method = 'pix' WHERE id = ?")
        .run(pgOrder.id, orderId);

      const tx = pgOrder.charges?.[0]?.last_transaction;
      if (!tx?.qr_code_url) throw new Error('QR Code não retornado pelo Pagar.me');

      const qrDataUrl = await QRCode.toDataURL(tx.qr_code_url, { width: 280, margin: 1, color: { dark: '#3D2B1F', light: '#FDFBF8' } });
      return ok(res, { qrCode: qrDataUrl, payload: tx.qr_code_url, total: order.total, source: 'pagarme' });
    } catch (e) {
      console.error('[Pagar.me PIX]', e.message);
      // continua para fallback
    }
  }

  // ── 2. Fallback: pix-utils (QR estático) ──────────────────
  if (!CONFIG.pixKey || CONFIG.pixKey === 'COLOQUE_SUA_CHAVE_PIX_AQUI') {
    return fail(res, 503, 'Chave PIX não configurada. Entre em contato com os noivos.');
  }
  try {
    const pix = createStaticPix({
      merchantName: CONFIG.pixNome,
      merchantCity: CONFIG.pixCidade,
      pixKey: CONFIG.pixKey,
      infoAdicional: `Cha de Panelas - Pedido ${orderId}`,
      txid: `ISANA${String(orderId).padStart(9, '0')}`,
      valor: order.total,
    });
    if (pixHasError(pix)) throw new Error('Payload PIX inválido');
    const payload = pix.toBRCode();
    const qrDataUrl = await QRCode.toDataURL(payload, { width: 280, margin: 1, color: { dark: '#3D2B1F', light: '#FDFBF8' } });
    return ok(res, { qrCode: qrDataUrl, payload, total: order.total, source: 'static' });
  } catch (e) {
    return fail(res, 500, 'Erro ao gerar QR Code: ' + e.message);
  }
});

// ── PIX RÁPIDO (público, por item) ───────────────────────────

app.get('/api/pix-quick', async (req, res) => {
  const itemId = parseInt(req.query.itemId, 10);
  if (!itemId) return fail(res, 400, 'itemId obrigatório');

  const item = ITEMS.find(i => i.id === itemId);
  if (!item) return fail(res, 404, 'Item não encontrado');

  try {
    const pix = createStaticPix({
      merchantName: CONFIG.pixNome,
      merchantCity: CONFIG.pixCidade,
      pixKey: CONFIG.pixKey,
      infoAdicional: 'Cha de Panelas',
      txid: `ISANA${String(itemId).padStart(9, '0')}`,
      valor: item.price,
    });
    if (pixHasError(pix)) throw new Error('Payload PIX inválido');
    const payload = pix.toBRCode();
    const qrDataUrl = await QRCode.toDataURL(payload, { width: 260, margin: 1, color: { dark: '#3D2B1F', light: '#FDFBF8' } });
    return ok(res, { qrCode: qrDataUrl, payload, valor: item.price, item: { id: item.id, name: item.name, emoji: item.emoji } });
  } catch (e) {
    return fail(res, 500, 'Erro ao gerar PIX: ' + e.message);
  }
});

// ── CARTÃO VIA PAGAR.ME ───────────────────────────────────────

app.post('/api/card-link', requireAuth, async (req, res) => {
  const orderId = parseInt(req.body.orderId, 10);
  if (!orderId) return fail(res, 400, 'orderId obrigatório');

  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .get(orderId, req.session.userId);
  if (!order) return fail(res, 404, 'Pedido não encontrado');

  if (!CONFIG.pagarme.secretKey) {
    return fail(res, 503, 'Pagamento por cartão ainda não configurado. Use PIX ou Transferência.');
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
    const rows = db.prepare('SELECT item_id, price FROM order_items WHERE order_id = ?').all(orderId);
    const pgItems = rows.map(r => {
      const it = ITEMS.find(x => x.id === r.item_id);
      return { amount: r.price * 100, description: (it ? it.name : `Item #${r.item_id}`).substring(0, 64), quantity: 1, code: String(r.item_id) };
    });

    const pgOrder = await pagarmeRequest('POST', '/orders', {
      items: pgItems,
      customer: { name: user.name, email: user.email, type: 'individual' },
      payments: [{
        payment_method: 'checkout',
        checkout: {
          accepted_payment_methods: ['credit_card'],
          credit_card: {
            statement_descriptor: 'CHA PANELAS',
            installments: [{ number: 1, total: order.total * 100 }],
          },
          skip_checkout_success_page: false,
          billing_address_editable: false,
          customer_editable: false,
        },
      }],
      metadata: { our_order_id: String(orderId) },
    });

    db.prepare("UPDATE orders SET pagarme_order_id = ?, payment_method = 'credit_card' WHERE id = ?")
      .run(pgOrder.id, orderId);

    const checkoutUrl = pgOrder.checkouts?.[0]?.payment_url;
    if (!checkoutUrl) throw new Error('URL de checkout não retornada pelo Pagar.me');

    return ok(res, { url: checkoutUrl, pagarmeOrderId: pgOrder.id });
  } catch (e) {
    return fail(res, 500, 'Erro ao criar checkout de cartão: ' + e.message);
  }
});

// ── WEBHOOK PAGAR.ME ─────────────────────────────────────────

app.post('/api/webhook/pagarme', express.raw({ type: '*/*' }), (req, res) => {
  if (CONFIG.pagarme.webhookSecret) {
    const crypto = require('crypto');
    const sig = req.headers['x-pagarme-signature'];
    const expected = crypto.createHmac('sha256', CONFIG.pagarme.webhookSecret)
      .update(req.body).digest('hex');
    if (sig !== expected) return res.status(401).send('Invalid signature');
  }
  try {
    const event = JSON.parse(req.body.toString());
    if (event.type === 'order.paid') {
      const pgId = event.data?.id;
      if (pgId) db.prepare("UPDATE orders SET status = 'paid' WHERE pagarme_order_id = ?").run(pgId);
    }
  } catch (e) { console.error('[Webhook]', e.message); }
  res.sendStatus(200);
});

// ── ADMIN ─────────────────────────────────────────────────────

app.get('/api/admin/orders', requireAdmin, (req, res) => {
  const orders = db.prepare(`
    SELECT o.*, u.name as user_name, u.email as user_email, u.phone as user_phone
    FROM orders o
    JOIN users u ON u.id = o.user_id
    ORDER BY o.created_at DESC
  `).all();

  const getItems = db.prepare('SELECT item_id, price FROM order_items WHERE order_id = ?');

  const enriched = orders.map(order => {
    const orderItems = getItems.all(order.id).map(oi => {
      const item = ITEMS.find(i => i.id === oi.item_id);
      return item ? { ...item, price: oi.price } : { id: oi.item_id, price: oi.price, name: 'Item removido' };
    });
    return { ...order, items: orderItems };
  });

  const totalPaid = enriched.filter(o => o.status === 'paid').reduce((s, o) => s + o.total, 0);
  const totalPending = enriched.filter(o => o.status === 'pending').reduce((s, o) => s + o.total, 0);
  const guests = new Set(enriched.map(o => o.user_id)).size;

  return ok(res, {
    orders: enriched,
    summary: { totalPaid, totalPending, guests },
  });
});

app.post('/api/admin/orders/:id/paid', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(id);
  if (!order) return fail(res, 404, 'Pedido não encontrado');
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('paid', id);
  return ok(res, { orderId: id, status: 'paid' });
});

// Cancela um pedido e libera os presentes de volta pra lista
app.post('/api/admin/orders/:id/cancel', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(id);
  if (!order) return fail(res, 404, 'Pedido não encontrado');
  const cancel = db.transaction(() => {
    db.prepare('DELETE FROM reserved_items WHERE order_id = ?').run(id);
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(id);
    db.prepare('DELETE FROM orders WHERE id = ?').run(id);
  });
  cancel();
  return ok(res, { orderId: id, cancelled: true });
});

// ──────────────────────────────────────────────────────────────
// START SERVER
// ──────────────────────────────────────────────────────────────
app.listen(CONFIG.port, () => {
  console.log(`Chá de Panelas server running at http://localhost:${CONFIG.port}`);
});
