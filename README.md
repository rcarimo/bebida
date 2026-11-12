# Bebida

App para iPhone e Android que regista as bebidas de uma noite no bar, mostra a conta no fim e guarda o histórico de gastos.
Feita com **Expo (React Native) + TypeScript**. Tudo fica primeiro no telefone (SQLite, funciona sem internet) e, quando a pessoa entra com email e senha, sincroniza com a sua conta no **Firebase**.

## Correr no telefone (5 minutos)

1. Instala o Node.js 20 ou mais recente.
2. Na pasta do projeto:
   ```bash
   npm install
   npx expo start
   ```
3. Instala a app **Expo Go** no telefone (App Store / Play Store) e lê o QR code que aparece no terminal.
   O telefone e o computador têm de estar na mesma rede Wi‑Fi (ou usa `npx expo start --tunnel`).

Sem configurar o Firebase a app já funciona por completo, só que os dados ficam apenas nesse telefone.

## Ligar a conta de email (Firebase)

1. Vai a <https://console.firebase.google.com> e cria um projeto (o plano gratuito chega).
2. **Authentication › Sign-in method**: ativa **Email/Password**.
3. **Firestore Database**: cria a base de dados (modo de produção, região próxima, ex.: `europe-west`).
4. **Firestore › Rules**: cola o conteúdo de `firestore.rules` e publica. Assim cada pessoa só vê os seus dados.
5. **Definições do projeto › As tuas apps**: adiciona uma app **Web** e copia o objeto de configuração.
6. Copia `.env.example` para `.env` e preenche os valores. Reinicia `npx expo start`.

No telefone: ecrã inicial › ícone de pessoa › criar conta ou entrar. A partir daí:
- cada registo é enviado para a conta alguns segundos depois (ou quando a app volta a abrir);
- noutro telefone, ao entrar com o mesmo email, o histórico aparece;
- sem internet continua tudo a funcionar e envia quando a rede voltar;
- ao sair da conta, envia o que falta e limpa o telefone (os dados ficam na conta).

## Como está organizado

```
src/
  app/                    ecrãs (Expo Router: cada ficheiro é um ecrã)
    index.tsx             início: "Comecei a beber", bares, resumo do mês
    precos/[barId].tsx    preços do dia (pré-preenchidos da última visita)
    noite/[nightId].tsx   noite ativa: toque = +1, segurar = −1, desfazer, segurar para fechar
    fechar/[nightId].tsx  resumo da conta (e detalhe de noites antigas)
    historico.tsx         gastos por semana / mês / ano / tudo, por bar e por bebida
    perfil.tsx            entrar com email e estado da sincronização
  lib/
    db.ts                 SQLite: tabelas e migrações
    repo.ts               todas as consultas e escritas
    sync.ts               sincronização SQLite ⇄ Firestore (users/{uid}/{tabela}/{id})
    firebase.ts           inicialização do Firebase a partir do .env
    format.ts             dinheiro, datas e períodos
  components/             botões, cartões, ícones
```

**Modelo de dados**: `bars`, `drinks` (menu de cada bar, com o último preço), `nights`, `night_prices` (preço de cada bebida nessa noite, por isso o histórico não muda quando os preços sobem) e `consumptions` (uma linha por bebida, o que torna o "desfazer" trivial).
Todas as tabelas têm `updated_at`, `deleted` (apagado lógico) e `dirty` (por enviar); a sincronização é "a última alteração ganha".

## Pensado para quem bebeu

- Botões grandes, tema escuro, contraste alto, vibração a cada toque.
- Durante a noite não há teclado: um toque soma, segurar tira, "Desfazer" aparece 5 segundos.
- Fechar a conta exige segurar o botão ~1,5 s.
- O ecrã não se apaga enquanto a noite está aberta.
- Uma noite esquecida aberta fecha sozinha depois de 12 horas sem registos.

## Anúncios (AdMob)

Os anúncios só aparecem em dois sítios, longe dos botões usados durante a noite:
- **Início**, um banner no fundo, só quando **não** há noite aberta;
- **Histórico**, um bloco entre "Por bar" e "Por bebida", sempre com a etiqueta "Anúncio".

Nunca aparecem nos preços, na noite ativa nem ao fechar a conta. O código está em `src/lib/ads.tsx`.

- **No Expo Go não há anúncios** (a biblioteca é nativa). Para os ver, gera um APK com `eas build`.
- Até configurares o AdMob, aparecem os **anúncios de teste** da Google ("Test Ad").
- **Premium** desliga todos os anúncios. Por agora há um interruptor de teste no ecrã Conta, visível só em desenvolvimento; quando houver compra na loja, ela chama `setPremium(true)`.

Para ganhar dinheiro a sério:
1. Cria conta em <https://admob.google.com>, adiciona a app (Android e iOS) e cria **dois blocos de anúncio Banner** (início e histórico).
2. Em `app.json`, no plugin `react-native-google-mobile-ads`, troca `androidAppId` e `iosAppId` pelos IDs da **app** (`ca-app-pub-...~...`).
3. No `.env` (e nas variáveis do EAS), preenche `EXPO_PUBLIC_ADMOB_BANNER_HOME` e `EXPO_PUBLIC_ADMOB_BANNER_HISTORY` com os IDs dos **blocos** (`ca-app-pub-.../...`).
4. Na consola AdMob › Controlos de bloqueio, bloqueia categorias sensíveis (jogos de azar, empréstimos rápidos, encontros).
5. Nunca toques nos teus próprios anúncios reais; para testar no teu telefone usa os IDs de teste.

## Publicar nas lojas

Usa o EAS (não precisas de Xcode nem Android Studio):

```bash
npx eas-cli@latest build --platform android   # gera o .aab / .apk
npx eas-cli@latest build --platform ios       # precisa de conta Apple Developer
```

Antes, troca os ícones em `assets/` e confirma `ios.bundleIdentifier` e `android.package` em `app.json`.

## Comandos úteis

```bash
npm run typecheck      # verificar tipos
npx expo-doctor        # verificar dependências
```
