import React, { useEffect, useMemo, useRef, useState } from "react";
import { CatalogService } from "./services/catalogService.js";
import { PriceService } from "./services/priceService.js";
import "./styles.css";
const IDLE_TIMEOUT_MS = 120000;
const ICE = "/media/ice/UT-ICE-Hero-001.png",
  OWNER = "/media/brand/owner.jpg",
  POS = "/media/payment/pos-terminal.png";
const TERMINAL = {
  id: "TMS-001",
  city: "Томск",
  place: "Городской сад",
  detail: "главный вход",
  latitude: 56.473333,
  longitude: 84.954444,
  adminUrl: "https://admin.utimoshi.ru",
};
const NONE_S = { id: "none", name: "Без посыпки", price: 0, available: true },
  NONE_T = { id: "none", name: "Без топпинга", price: 0, available: true };
const money = (v, c = "RUB") => PriceService.format(v, c);
const weatherInfo = (code) => {
  if (code === 0) return ["☀️", "Ясно"];
  if ([1, 2].includes(code)) return ["🌤️", "Небольшая облачность"];
  if (code === 3) return ["☁️", "Облачно"];
  if ([45, 48].includes(code)) return ["🌫️", "Туман"];
  if ([51, 53, 55, 56, 57].includes(code)) return ["🌦️", "Морось"];
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return ["🌧️", "Дождь"];
  if ([71, 73, 75, 77, 85, 86].includes(code)) return ["🌨️", "Снег"];
  if ([95, 96, 99].includes(code)) return ["⛈️", "Гроза"];
  return ["🌤️", "Погода"];
};
function Top() {
  const [n, setN] = useState(new Date()),
    [w, setW] = useState({ temp: null, code: null }),
    tap = useRef({ count: 0, last: 0 });
  useEffect(() => {
    const i = setInterval(() => setN(new Date()), 30000);
    return () => clearInterval(i);
  }, []);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${TERMINAL.latitude}&longitude=${TERMINAL.longitude}&current=temperature_2m,weather_code&timezone=Asia%2FTomsk`,
        );
        if (!r.ok) throw new Error();
        const j = await r.json();
        if (alive && j.current)
          setW({
            temp: Math.round(j.current.temperature_2m),
            code: j.current.weather_code,
          });
      } catch {}
    };
    load();
    const i = setInterval(load, 600000);
    return () => {
      alive = false;
      clearInterval(i);
    };
  }, []);
  const [icon, text] = weatherInfo(w.code);
  const adminTap = () => {
    const now = Date.now();
    tap.current.count =
      now - tap.current.last < 900 ? tap.current.count + 1 : 1;
    tap.current.last = now;
    if (tap.current.count >= 3) {
      tap.current.count = 0;
      window.location.href = TERMINAL.adminUrl;
    }
  };
  return (
    <header className="terminal-header">
      <div className="brand-left">
        <img src={OWNER} />
        <div>
          <strong>У Тимоши</strong>
          <small>Счастье в одном стаканчике!</small>
        </div>
        <i>♡</i>
      </div>
      <div className="weather-center">
        <div>
          <span>
            {new Intl.DateTimeFormat("ru-RU", {
              day: "numeric",
              month: "long",
              timeZone: "Asia/Tomsk",
            }).format(n)}
          </span>
          <b>
            {n.toLocaleTimeString("ru-RU", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Tomsk",
            })}
          </b>
          <span className="weather-value">
            {w.temp === null
              ? "Погода —"
              : `${icon} ${w.temp > 0 ? "+" : ""}${w.temp}°`}
          </span>
        </div>
        <small>
          {w.temp === null
            ? "Получаем данные погоды…"
            : `${text}, ${TERMINAL.city}`}
        </small>
      </div>
      <button
        className="terminal-info"
        onClick={adminTap}
        aria-label="Информация об аппарате"
      >
        <strong>Аппарат № {TERMINAL.id}</strong>
        <small>
          {TERMINAL.place}, {TERMINAL.detail}
        </small>
      </button>
    </header>
  );
}
function Shell({ children, back = true, onBack }) {
  return (
    <main className="approved">
      <Top />
      {children}
      {back && (
        <button className="back" onClick={onBack}>
          ←&nbsp; Назад
        </button>
      )}
    </main>
  );
}
function Hero() {
  return (
    <div
      className="left-hero"
      style={{ left: "4.5%", width: "31vw", background: "transparent" }}
    >
      <img
        src={ICE}
        style={{
          mixBlendMode: "multiply",
          background: "transparent",
          transform: "translateX(8%) scale(1.06)",
          transformOrigin: "center bottom",
        }}
      />
      <small>* Вкус дня может быть изменен</small>
    </div>
  );
}
function Timer({ reset }) {
  const [l, setL] = useState(35),
    [ask, setAsk] = useState(false);
  useEffect(() => {
    if (ask) return;
    let i = setInterval(
      () =>
        setL((x) => {
          if (x <= 1) {
            clearInterval(i);
            setAsk(true);
            return 0;
          }
          return x - 1;
        }),
      1000,
    );
    return () => clearInterval(i);
  }, [ask]);
  return (
    <>
      <div className="timer">
        <small>Осталось</small>
        <b>{`00:${String(l).padStart(2, "0")}`}</b>
      </div>
      {ask && (
        <div className="time-question">
          <span>◷</span>
          <b>Вам требуется еще время для выбора?</b>
          <small>
            Экран вернётся на начальную страницу после вашего выбора.
          </small>
          <div>
            <button onClick={reset}>Нет</button>
            <button
              onClick={() => {
                setAsk(false);
                setL(35);
              }}
            >
              Да
            </button>
          </div>
        </div>
      )}
    </>
  );
}
const art = (id) =>
  id === "none"
    ? "⊘"
    : id === "nut_crumb"
      ? "🥜"
      : id === "confetti"
        ? "🍬"
        : id === "wafer_crumb"
          ? "🧇"
          : id === "chocolate"
            ? "🍫"
            : id === "strawberry"
              ? "🍓"
              : "🍮";
function Choose({ type, items, value, setValue, next, back, home }) {
  const sprinkle = type === "sprinkle";

  const imageFor = (x) => {
    if (sprinkle) {
      if (x.id === "none") return "/media/toppings/NO4.png";
      if (x.id === "nut_crumb") return "/media/toppings/nuts.png";
      if (x.id === "confetti") return "/media/toppings/confetti.png";
      if (x.id === "chocolate_crumb") return "/media/toppings/chocolate.png";
      if (x.id === "wafer_crumb") return "/media/toppings/wafer.png";
      return "/media/toppings/NO4.png";
    }

    if (x.id === "none") return "/media/sauces/NO.png";
    if (x.id === "strawberry") return "/media/sauces/strawberry.png";
    if (x.id === "chocolate") return "/media/sauces/chocolate.png";
    if (x.id === "caramel") return "/media/sauces/caramel.png";

    return "/media/sauces/NO.png";
  };

  return (
    <Shell onBack={back}>
      <Timer reset={home} />
      <Hero />

      <section className="choice">
        <div className="pill">Соберите своё мороженое</div>

        <h1>{sprinkle ? "Выберите посыпку" : "Выберите топпинг"}</h1>

        <p>Можно продолжить {sprinkle ? "без посыпки" : "без топпинга"}</p>

        <div className="choice-grid">
          {items.map((x) => (
            <button
              className={value.id === x.id ? "picked" : ""}
              onClick={() => setValue(x)}
              key={x.id}
            >
              <div className="food-art">
                <img
                  className="choice-product-image"
                  src={imageFor(x)}
                  alt={x.name}
                />
              </div>

              <b>{x.name}</b>
              <span>{x.price ? `+ ${x.price} ₽` : "Бесплатно"}</span>
              <i>{value.id === x.id ? "✓" : ""}</i>
            </button>
          ))}
        </div>

        <button className="pink next" onClick={next}>
          Продолжить&nbsp;&nbsp;→
        </button>
      </section>
    </Shell>
  );
}

function Summary({ p, s, t, total, edit, pay, back }) {
  return (
    <Shell onBack={back}>
      <Hero />
      <section className="summary">
        <div className="pill">Проверьте ваш заказ</div>
        <h1>Вы собрали своё мороженое</h1>
        <p>Проверьте состав и при необходимости измените</p>
        <div className="sum-grid">
          <article>
            <h3>Мороженое</h3>
            <img src={ICE} />
            <b>{p.name}</b>
            <span>{money(p.price, p.currency)}</span>
          </article>
          <article>
            <h3>Топпинг</h3>
            <div className="food-art">{art(t.id)}</div>
            <b>{t.name}</b>
            <span>{t.price ? `+ ${t.price} ₽` : "0 ₽"}</span>
            <button onClick={() => edit("topping")}>✎ Изменить</button>
          </article>
          <article>
            <h3>Посыпка</h3>
            <div className="food-art">{art(s.id)}</div>
            <b>{s.name}</b>
            <span>{s.price ? `+ ${s.price} ₽` : "0 ₽"}</span>
            <button onClick={() => edit("sprinkle")}>✎ Изменить</button>
          </article>
          <article className="total">
            <h2>
              Итого
              <br />
              <strong>{money(total, p.currency)}</strong>
            </h2>
            <hr />
            <p>Мороженое — {money(p.price, p.currency)}</p>
            <p>Топпинг — {money(t.price, p.currency)}</p>
            <p>Посыпка — {money(s.price, p.currency)}</p>
          </article>
        </div>
        <button className="pink pay-next" onClick={pay}>
          Перейти к оплате　→
        </button>
      </section>
    </Shell>
  );
}
function Club({ next, back }) {
  const [ph, setPh] = useState(""),
    [confirm, setConfirm] = useState(false),
    [sent, setSent] = useState(false),
    [code, setCode] = useState("");
  let ok = ph.length === 10;
  let fmt = ok
    ? `+7 (${ph.slice(0, 3)}) ${ph.slice(3, 6)}-${ph.slice(6, 8)}-${ph.slice(8)}`
    : "+7 (___) ___-__-__";
  return (
    <Shell onBack={back}>
      <Hero />
      <section className="club">
        <div className="pill">Клуб Тимоши</div>
        <h1>Получите свою скидку</h1>
        <p>
          Введите номер телефона, чтобы стать участником
          <br />
          Клуба Тимоши и получать специальные предложения
        </p>
        <div className="phone">
          <span>+7</span>
          <input
            autoFocus
            inputMode="numeric"
            value={ph}
            onChange={(e) =>
              setPh(e.target.value.replace(/\D/g, "").slice(0, 10))
            }
            placeholder="(___) ___-__-__"
          />
        </div>
        <div className="keys">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
            <button key={n} onClick={() => setPh((ph + n).slice(0, 10))}>
              {n}
            </button>
          ))}
          <button onClick={() => setPh(ph.slice(0, -1))}>⌫</button>
        </div>
        <button
          className="code"
          disabled={!ok}
          onClick={() => setConfirm(true)}
        >
          Получить код
        </button>
        <button className="skip" onClick={next}>
          Продолжить без скидки<small>Купить мороженое без регистрации</small>
        </button>
      </section>
      {confirm && (
        <div className="modal">
          <div>
            <button className="x" onClick={() => setConfirm(false)}>
              ×
            </button>
            <span className="phone-icon">☎</span>
            <h2>
              Вы уверены,
              <br />
              что номер введён правильно?
            </h2>
            <strong>{fmt}</strong>
            <p>
              На этот номер мы отправим код для подтверждения
              <br />
              или ссылку на подписку в Telegram / MAX
            </p>
            <div className="modal-actions">
              <button onClick={() => setConfirm(false)}>Нет, изменить</button>
              <button className="pink" onClick={() => setSent(true)}>
                Да, отправить код
              </button>
            </div>
            {sent && (
              <div className="code-entry">
                <input
                  inputMode="numeric"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="Введите код"
                />
                <button className="pink" onClick={next}>
                  Подтвердить
                </button>
                <button onClick={next}>Продолжить без кода</button>
              </div>
            )}
            <small>
              Если код не придёт, вы всегда можете продолжить покупку без
              скидки.
            </small>
          </div>
        </div>
      )}
    </Shell>
  );
}
function Order({ p, s, t, total }) {
  return (
    <aside className="order">
      <h2>Ваш заказ</h2>
      <div>
        <img src={ICE} />
        <span>
          Мягкое мороженое
          <br />
          <b>({p.name})</b>
        </span>
        <strong>{p.price} ₽</strong>
      </div>
      {t.id !== "none" && (
        <div>
          <div className="mini-art">{art(t.id)}</div>
          <span>
            Топпинг
            <br />
            <b>{t.name}</b>
          </span>
          <strong>{t.price} ₽</strong>
        </div>
      )}
      {s.id !== "none" && (
        <div>
          <div className="mini-art">{art(s.id)}</div>
          <span>
            Посыпка
            <br />
            <b>{s.name}</b>
          </span>
          <strong>{s.price} ₽</strong>
        </div>
      )}
      <footer>
        <b>Итого к оплате</b>
        <strong>{total} ₽</strong>
      </footer>
    </aside>
  );
}
function Payment({ p, s, t, total, card, back }) {
  const [phone, setPhone] = useState("");
  return (
    <Shell onBack={back}>
      <div className="payment">
        <Order {...{ p, s, t, total }} />
        <section className="methods">
          <h1>Выберите способ оплаты</h1>
          <div className="method-row">
            <button className="selected">
              <b>◆ Оплата по СБП</b>
              <small>Быстро и удобно</small>
              <i>✓</i>
            </button>
            <button onClick={card}>
              <b>▣ Банковская карта</b>
              <small>Visa · Mastercard · Мир</small>
              <i>○</i>
            </button>
          </div>
          <div className="sbp">
            <div className="qr">
              ▦
              <small>
                QR СБП
                <br />
                от платёжного провайдера
              </small>
            </div>
            <div>
              <h2>
                Оплатите через
                <br />
                приложение вашего банка
              </h2>
              <ol>
                <li>Откройте приложение банка</li>
                <li>Отсканируйте QR-код</li>
                <li>Подтвердите оплату</li>
              </ol>
            </div>
            <div className="send">
              <b>
                ➤ Отправить ссылку
                <br />
                на оплату на телефон
              </b>
              <input
                value={phone}
                onChange={(e) =>
                  setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                }
                placeholder="+7 ___ ___-__-__"
              />
              <button disabled={phone.length !== 10}>Отправить ссылку</button>
            </div>
          </div>
          <small className="reg-note">
            ⓘ Ввод номера телефона здесь не является регистрацией в «Клубе
            Тимоши»
          </small>
        </section>
      </div>
    </Shell>
  );
}
function Card({ total, wait, back }) {
  return (
    <Shell onBack={back}>
      <section className="card-pay">
        <h1>Оплата банковской картой</h1>
        <div>
          <div>
            <h2>Банковская карта</h2>
            <p>
              К оплате <strong>{total} ₽</strong>
            </p>
          </div>
          <img src={POS} />
          <p>
            Приложите карту к терминалу
            <br />
            или вставьте в считыватель
          </p>
        </div>
        <button className="pink" onClick={wait}>
          Оплата начата
        </button>
      </section>
    </Shell>
  );
}
function Waiting() {
  return (
    <Shell back={false}>
      <section className="waiting">
        <div className="spinner" />
        <h1>Ожидаем подтверждение оплаты от банка</h1>
        <p>Пожалуйста, не закрывайте экран.</p>
      </section>
    </Shell>
  );
}

function IdleScreen({ onWake }) {
  return (
    <main
      className="terminal-idle"
      onClick={onWake}
      onTouchStart={onWake}
      role="button"
      tabIndex={0}
      onKeyDown={onWake}
    >
      <section className="terminal-idle-visual">
        <img src={ICE} alt="Мороженое У Тимоши" />
      </section>

      <section className="terminal-idle-copy">
        <div className="terminal-idle-brand">У ТИМОШИ</div>

        <h1>
          Счастье в<br />
          одном<br />
          стаканчике
        </h1>

        <p>Мягкое мороженое — приготовим прямо сейчас.</p>

        <div className="terminal-idle-start">
          Коснитесь экрана, чтобы начать
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const c = useMemo(() => CatalogService.getSnapshot(), []),
    p = c.product;
  const [screen, setScreen] = useState("home"),
    [isIdle, setIsIdle] = useState(false),
    idleTimerRef = useRef(null),
    [s, setS] = useState(NONE_S),
    [t, setT] = useState(NONE_T);
  let total = PriceService.total(p, s, t),
    home = () => {
      setScreen("home");
      setS(NONE_S);
      setT(NONE_T);
    };

  const resetIdleTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

    if (!isIdle) {
      idleTimerRef.current = setTimeout(() => {
        setIsIdle(true);
      }, IDLE_TIMEOUT_MS);
    }
  };

  useEffect(() => {
    const events = ["pointerdown", "touchstart", "keydown"];

    const activity = () => {
      if (!isIdle) resetIdleTimer();
    };

    resetIdleTimer();

    events.forEach((eventName) => {
      window.addEventListener(eventName, activity, { passive: true });
    });

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

      events.forEach((eventName) => {
        window.removeEventListener(eventName, activity);
      });
    };
  }, [isIdle]);

  const wakeFromIdle = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

    setScreen("home");
    setS(NONE_S);
    setT(NONE_T);
    setIsIdle(false);
  };

  if (isIdle) {
    return <IdleScreen onWake={wakeFromIdle} />;
  }

  if (screen === "home")
    return (
      <main className="approved home">
        <Top />
        <Hero />
        <section className="home-content">
          <div className="pill">Сегодня в аппарате</div>
          <h1>{p.name}</h1>
          <p>Мягкое мороженое в фирменном стаканчике</p>
          <button className="pink" onClick={() => setScreen("topping")}>
            Собери свой вкус　→
          </button>
          <button className="home-club" onClick={() => setScreen("club")}>
            ♥　<b>Клуб Тимоши</b>
            <small>Каждая 50-я покупка — в подарок</small>
            <strong>Получить свою скидку</strong>
          </button>
        </section>
      </main>
    );
  if (screen === "sprinkle")
    return (
      <Choose
        type="sprinkle"
        items={[NONE_S, ...c.sprinkles.filter((x) => x.id !== "none")]}
        value={s}
        setValue={setS}
        next={() => setScreen("summary")}
        back={() => setScreen("topping")}
        home={home}
      />
    );
  if (screen === "topping")
    return (
      <Choose
        type="topping"
        items={[NONE_T, ...c.sauces.filter((x) => x.id !== "none")]}
        value={t}
        setValue={setT}
        next={() => setScreen("sprinkle")}
        back={home}
        home={home}
      />
    );
  if (screen === "summary")
    return (
      <Summary
        {...{ p, s, t, total }}
        edit={setScreen}
        pay={() => setScreen("club")}
        back={() => setScreen("sprinkle")}
      />
    );
  if (screen === "club")
    return (
      <Club
        next={() => setScreen("payment")}
        back={() => setScreen("summary")}
      />
    );
  if (screen === "payment")
    return (
      <Payment
        {...{ p, s, t, total }}
        card={() => setScreen("card")}
        back={() => setScreen("club")}
      />
    );
  if (screen === "card")
    return (
      <Card
        total={total}
        wait={() => setScreen("waiting")}
        back={() => setScreen("payment")}
      />
    );
  if (screen === "waiting") return <Waiting />;
  return null;
}
