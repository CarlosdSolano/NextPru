// ========================================
// DETALLE DEL AUTO (se abre al seleccionar un carro del inventario)
// Vive en su propia página (configurador.html) y se muestra dentro de un iframe para que su
// hoja de estilos (configurador.css) no se mezcle con la del sitio. React 16 por CDN, sin JSX:
// el árbol se escribe con React.createElement.
// ========================================

const AVISO = document.getElementById("aviso");
if (!window.React || !window.ReactDOM || !window.ReactTransitionGroup || !window.BezierEasing) {
  AVISO.hidden = false;
  throw new Error("No cargaron las librerías del detalle del auto");
}

const { TransitionGroup, CSSTransition } = ReactTransitionGroup;
const h = React.createElement;

const ANIMATION_PHASES = { PENDING: "PENDING", STOP: "STOP" };

// La rotación automática de la especificación original cambiaba de modelo cada 2 s. Aquí la
// persona ya eligió un carro, así que arranca apagada. Ponla en true para activarla.
const AUTO_ROTAR = false;

// ---------- Imágenes (SVG propios, sin depender de archivos externos) ----------
const svgUri = (svg) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);

const logoNextAuto = svgUri(
  '<svg xmlns="http://www.w3.org/2000/svg" width="104" height="14" viewBox="0 0 104 14">' +
  '<text x="0" y="12" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="14" letter-spacing="3" fill="#fff">NEXTAUTO</text></svg>'
);

const mouseImg = svgUri(
  '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="40" viewBox="0 0 26 40" fill="none" stroke="#fff" stroke-width="2">' +
  '<rect x="1" y="1" width="24" height="38" rx="12"/><line x1="13" y1="9" x2="13" y2="17" stroke-linecap="round"/></svg>'
);

// Se muestra si la foto del carro no existe todavía
const fotoPendienteImg = svgUri(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" viewBox="0 0 1200 700" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="6" stroke-linejoin="round">' +
  '<path d="M170 430c0-40 25-60 70-66l130-100c20-16 45-24 70-24h300c30 0 55 10 78 30l92 94c60 8 100 20 120 40 10 10 10 26 10 40v10H170z"/>' +
  '<circle cx="360" cy="470" r="62" fill="#000"/><circle cx="880" cy="470" r="62" fill="#000"/>' +
  '<text x="600" y="610" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="40" fill="#fff" fill-opacity=".6" stroke="none">Foto próximamente</text></svg>'
);

// ---------- Datos: cada auto del inventario se convierte en un "slide" ----------
const PALETA = ["#e7b53c", "#0047fd", "#ee0101", "#1fb36b", "#9b5cff", "#ff7a1a"];

function colorDe(marca) {
  let hash = 0;
  for (const letra of marca) hash = (hash * 31 + letra.charCodeAt(0)) >>> 0;
  return PALETA[hash % PALETA.length];
}

function crearSlides(autos) {
  return autos.map((a, i) => {
    const completo = a.marca + " " + a.modelo;
    const km = a.km.toLocaleString("es-CO");
    return {
      id: i + 1,
      // "Audi A4" cabe en el titular; los nombres largos ("Toyota Corolla Cross") usan solo el modelo
      name: completo.length <= 14 ? completo : a.modelo,
      shortName: a.modelo,
      alt: completo + " " + a.anio,
      desc: a.descuento
        ? "Modelo " + a.anio + " con " + km + " km y " + a.descuento + " % de descuento."
        : "Modelo " + a.anio + " con " + km + " km, disponible en Bogotá.",
      color: colorDe(a.marca),
      imgUrl: a.foto,
      wa: a.wa,
      anio: a.anio,
      km: a.km,
      precioMillones: a.precio / 1000000,
      bckgHeight: 300,
      carShadowHeight: 250,
      shadowOpacity: 0.3,
    };
  });
}

// ========================================
// EFFECT-01: variables CSS por carro
// ========================================
class SetCSSVariables extends React.Component {
  apply(variables) {
    Object.keys(variables).forEach((key) => {
      document.documentElement.style.setProperty(key, variables[key]);
    });
  }

  // En la especificación solo se aplicaban al recibir props; aquí también al montarse,
  // porque el detalle abre directamente en el carro elegido.
  componentDidMount() {
    this.apply(this.props.cssVariables);
  }

  componentWillReceiveProps(props) {
    // Un elemento que está saliendo conserva sus props viejas: si no cambiaron, no se reaplican
    // (si no, pisarían los colores del carro que está entrando).
    if (JSON.stringify(props.cssVariables) !== JSON.stringify(this.props.cssVariables)) {
      this.apply(props.cssVariables);
    }
  }

  render() {
    return this.props.children;
  }
}

// ========================================
// EFFECT-04: contadores animados
// ========================================
const myEasing = BezierEasing(0.4, -0.7, 0.1, 1.5);

function animate(render, duration, easing, next = () => null) {
  const start = Date.now();
  (function loop() {
    const step = (Date.now() - start) / duration;
    if (step <= 1) {
      requestAnimationFrame(loop);
      render(easing(step * 2));
    } else {
      render(1);
      next();
    }
  })();
}

class AnimValue extends React.Component {
  constructor(props) {
    super(props);
    this.node = null;
    this.timeout = null;
    this.run = 0;
    this.setValue = this.setValue.bind(this);
  }

  animate(previousValue, newValue, applyFn) {
    window.clearTimeout(this.timeout);
    const run = ++this.run; // una animación nueva invalida a la anterior
    const diff = newValue - previousValue;
    const renderFunction = (step) => {
      if (run !== this.run) return;
      this.timeout = setTimeout(() => {
        if (run !== this.run) return;
        applyFn(this.props.transformFn(previousValue + diff * step, step), step);
      }, this.props.delay);
    };
    animate(renderFunction, this.props.duration, myEasing);
  }

  setValue(value, step) {
    if (!this.node) return;
    this.node.style.opacity = step === 1 ? 1 : 0.7;
    this.node.innerHTML = value;
  }

  componentDidMount() {
    this.animate(0, this.props.value, this.setValue);
  }

  componentWillReceiveProps(props) {
    if (props.value !== this.props.value) {
      this.animate(this.props.value, props.value, this.setValue);
    }
  }

  componentWillUnmount() {
    this.run++;
    window.clearTimeout(this.timeout);
  }

  render() {
    return h("span", {
      className: this.props.className,
      children: "0",
      ref: (node) => (this.node = node),
    });
  }
}

AnimValue.defaultProps = {
  delay: 0,
  duration: 800,
  transformFn: (value) => Math.floor(value),
};

function AnimateValue(props) {
  // "miles" agrega el punto de miles (34.000) al kilometraje
  const formato = (n) => (props.miles ? Number(n).toLocaleString("es-CO") : n);
  return h(
    AnimValue,
    Object.assign({}, props, {
      transformFn: (value, step) =>
        step === 1
          ? value % 1 !== 0 ? value.toFixed(1) : formato(value)
          : formato(Math.abs(Math.floor(value))),
    })
  );
}

let DELAY_PRIMERO = 200, DELAY_SEGUNDO = 700, DELAY_TERCERO = 1200;

// ========================================
// SECTION-03: encabezado (el botón de cerrar lo pone la página que abre este detalle)
// ========================================
function Header() {
  return h(
    "div",
    { className: "tesla-header" },
    h("div", { className: "tesla-header__logo" }, h("img", { src: logoNextAuto, alt: "NextAuto" })),
    h("div", { className: "tesla-header__nav" })
  );
}

// ========================================
// SECTION-04: nombre, descripción y botón (EFFECT-03: transiciones)
// ========================================
function SlideAside({ activeCar, onReservar }) {
  return h(
    "div",
    { className: "tesla-slide-aside" },
    h(
      "h1",
      { className: "tesla-slide-aside__wholename" },
      h(
        TransitionGroup,
        { component: "span", className: "tesla-slide-aside__name" },
        h(
          CSSTransition,
          {
            key: "n" + activeCar.id,
            className: "tesla-slide-aside__name-part",
            classNames: "tesla-slide-aside__name-part-",
            timeout: { enter: 800, exit: 1000 },
            mountOnEnter: true,
            unmountOnExit: true,
          },
          h("span", null, activeCar.name)
        )
      )
    ),
    h(
      TransitionGroup,
      { className: "tesla-slide-aside__desc" },
      h(
        CSSTransition,
        {
          key: "d" + activeCar.id,
          className: "tesla-slide-aside__desc-text",
          classNames: "tesla-slide-aside__desc-text-",
          timeout: { enter: 900, exit: 1200 },
          mountOnEnter: true,
          unmountOnExit: true,
        },
        h("p", null, activeCar.desc)
      )
    ),
    h(
      "div",
      { className: "tesla-slide-aside__button" },
      h("button", { className: "button", type: "button", onClick: onReservar }, "Preguntar por WhatsApp"),
      h(
        TransitionGroup,
        null,
        h(
          CSSTransition,
          {
            key: activeCar.color,
            classNames: "button__border-",
            timeout: { enter: 800, exit: 1000 },
            mountOnEnter: true,
            unmountOnExit: true,
          },
          h(
            SetCSSVariables,
            { cssVariables: { "--btn-color": activeCar.color } },
            h("span", { className: "button__border" })
          )
        )
      )
    )
  );
}

// ========================================
// SECTION-06: datos del auto con contadores
// ========================================
class SlideParams extends React.Component {
  componentWillReceiveProps(props) {
    if (props.animationForward) {
      DELAY_PRIMERO = 200;
      DELAY_TERCERO = 1200;
    } else {
      DELAY_PRIMERO = 1200;
      DELAY_TERCERO = 200;
    }
  }

  render() {
    const { activeCar } = this.props;
    const valor = "tesla-slide-params__value";
    return h(
      "div",
      { className: "tesla-slide-params" },
      h(
        "ul",
        { className: "tesla-slide-params__list" },
        h(
          "li",
          { className: "tesla-slide-params__item" },
          h(
            "div",
            { className: "tesla-slide-params__wrapper" },
            h(AnimateValue, { className: valor, value: activeCar.anio, delay: DELAY_PRIMERO })
          ),
          h("p", { className: "tesla-slide-params__name" }, "Año")
        ),
        h(
          "li",
          { className: "tesla-slide-params__item" },
          h(
            "div",
            { className: "tesla-slide-params__wrapper" },
            h(AnimateValue, { className: valor, value: activeCar.km, delay: DELAY_SEGUNDO, miles: true }),
            h("span", { className: "tesla-slide-params__sufix" }, "km")
          ),
          h("p", { className: "tesla-slide-params__name" }, "Kilometraje")
        ),
        h(
          "li",
          { className: "tesla-slide-params__item" },
          h(
            "div",
            { className: "tesla-slide-params__wrapper" },
            h("span", { className: "tesla-slide-params__prefix" }, "$"),
            h(AnimateValue, { className: valor, value: activeCar.precioMillones, delay: DELAY_TERCERO }),
            h("span", { className: "tesla-slide-params__sufix" }, "M")
          ),
          h("p", { className: "tesla-slide-params__name" }, "Precio en millones de pesos")
        )
      )
    );
  }
}

// ========================================
// SECTION-05: resplandor + fotos (EFFECT-03)
// ========================================
class Slide extends React.Component {
  constructor(props) {
    super(props);
    this.handleEnter = this.handleEnter.bind(this);
  }

  handleEnter() {
    this.props.setAnimationState(this.props.ANIMATION_PHASES.STOP);
  }

  render() {
    const { activeSlide, animationForward } = this.props;
    const activeCar = activeSlide;

    return h(
      "div",
      { className: "tesla-slide " + (animationForward ? "animation-forward" : "animation-back") },
      h(SlideAside, { activeCar, onReservar: () => window.open(activeCar.wa, "_blank", "noopener") }),
      h(
        TransitionGroup,
        null,
        h(
          CSSTransition,
          {
            key: "b" + activeSlide.id,
            classNames: "tesla-slide__bckg-",
            timeout: { enter: 800, exit: 1000 },
            mountOnEnter: true,
            unmountOnExit: true,
          },
          h(
            SetCSSVariables,
            {
              cssVariables: {
                "--car-color": activeSlide.color,
                "--bckg-height": activeSlide.bckgHeight + "px",
                "--shadow-opacity": activeSlide.shadowOpacity,
                "--car-shadow-height": activeSlide.carShadowHeight + "px",
              },
            },
            h("div", { className: "tesla-slide__bckg" }, h("div", { className: "tesla-slide__bckg-fill" }))
          )
        )
      ),
      h(
        TransitionGroup,
        null,
        h(
          CSSTransition,
          {
            key: "i" + activeSlide.id,
            classNames: "tesla-slide__img-",
            timeout: { enter: 700, exit: 1200 },
            mountOnEnter: true,
            unmountOnExit: true,
            onEntered: this.handleEnter,
          },
          // Las fotos de los carros no traen una placa de sombra aparte, así que solo va la foto
          h(
            "div",
            { className: "tesla-slide__img" },
            h("img", {
              className: "tesla-slide__img-car",
              src: activeSlide.imgUrl,
              alt: activeSlide.alt,
              onError: (e) => { e.target.onerror = null; e.target.src = fotoPendienteImg; },
            })
          )
        )
      ),
      h(SlideParams, { activeCar, animationForward })
    );
  }
}

// ========================================
// SECTION-07: lista de modelos
// ========================================
class SliderNavigation extends React.Component {
  render() {
    const { activeSlide, carsNames, setActiveSlide } = this.props;
    return h(
      "div",
      { className: "tesla-slider-navigation" },
      h(
        "ul",
        { className: "tesla-slider-navigation__list" },
        carsNames.map((car) => {
          const activo = car.index === activeSlide;
          return h(
            "li",
            { className: "tesla-slider-navigation__item", key: car.id },
            h(
              "a",
              {
                href: "#",
                className: activo ? "tesla-slider-navigation__link--active" : "",
                style: { color: activo ? car.color : "" },
                "aria-current": activo ? "true" : undefined,
                onClick: (event) => {
                  event.preventDefault();
                  setActiveSlide(car.index);
                },
              },
              car.name
            )
          );
        })
      )
    );
  }
}

// ========================================
// EFFECT-02: navegación con la rueda del mouse
// ========================================
class Slider extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      activeSlide: props.inicio, // abre directamente en el carro elegido
      animationForward: true,
      slidesCount: props.slides.length,
      animationState: null,
    };
    this.slider = { header: "", content: "" };
    this.timeout = null;
    this.autoRotateInterval = null;
    this.touchX = null;

    this.handleScroll = this.handleScroll.bind(this);
    this.setActiveSlide = this.setActiveSlide.bind(this);
    this.setAnimationState = this.setAnimationState.bind(this);
    this.restartAutoRotate = this.restartAutoRotate.bind(this);
    this.medirVentana = this.medirVentana.bind(this);
    this.handleKey = this.handleKey.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
  }

  componentDidMount() {
    this.slider.header = document.querySelector(".tesla-header");
    this.slider.content = document.querySelector(".tesla-slider");
    // passive:false: sin esto Chrome ignora preventDefault en la rueda sobre el body
    document.body.addEventListener("wheel", this.handleScroll, { passive: false });
    document.addEventListener("keydown", this.handleKey);
    document.body.addEventListener("touchstart", this.handleTouchStart, { passive: true });
    document.body.addEventListener("touchend", this.handleTouchEnd, { passive: true });
    window.addEventListener("resize", this.medirVentana);
    window.addEventListener("load", this.medirVentana);
    this.medirVentana();
    this.restartAutoRotate();
  }

  componentWillUnmount() {
    document.body.removeEventListener("wheel", this.handleScroll);
    document.removeEventListener("keydown", this.handleKey);
    document.body.removeEventListener("touchstart", this.handleTouchStart);
    document.body.removeEventListener("touchend", this.handleTouchEnd);
    window.removeEventListener("resize", this.medirVentana);
    window.removeEventListener("load", this.medirVentana);
    window.clearTimeout(this.timeout);
    window.clearInterval(this.autoRotateInterval);
  }

  // Si el contenido no cabe en la ventana, se deja el scroll normal de la página
  ventanaBaja() {
    return window.innerHeight < this.slider.content.clientHeight + this.slider.header.clientHeight;
  }

  medirVentana() {
    document.documentElement.classList.toggle("scroll-nativo", this.ventanaBaja());
  }

  handleScroll(e) {
    if (this.ventanaBaja()) return;
    e.preventDefault();
    window.clearTimeout(this.timeout);
    this.timeout = setTimeout(() => {
      const { activeSlide, slidesCount } = this.state;
      if (e.deltaY < 0 && activeSlide !== 0) {
        this.setActiveSlide(activeSlide - 1);
      } else if (e.deltaY > 0 && activeSlide !== slidesCount - 1) {
        this.setActiveSlide(activeSlide + 1);
      }
    }, 50);
  }

  // Teclado y gestos táctiles: la rueda no existe en el celular
  handleKey(e) {
    const { activeSlide, slidesCount } = this.state;
    if (e.key === "Escape") {
      window.parent.postMessage({ tipo: "cerrar" }, "*");
    } else if ((e.key === "ArrowDown" || e.key === "ArrowRight") && activeSlide < slidesCount - 1) {
      this.setActiveSlide(activeSlide + 1);
    } else if ((e.key === "ArrowUp" || e.key === "ArrowLeft") && activeSlide > 0) {
      this.setActiveSlide(activeSlide - 1);
    }
  }

  handleTouchStart(e) {
    this.touchX = e.changedTouches[0].clientX;
  }

  handleTouchEnd(e) {
    if (this.touchX === null) return;
    const dx = e.changedTouches[0].clientX - this.touchX;
    this.touchX = null;
    const { activeSlide, slidesCount } = this.state;
    if (dx < -60 && activeSlide < slidesCount - 1) this.setActiveSlide(activeSlide + 1);
    if (dx > 60 && activeSlide > 0) this.setActiveSlide(activeSlide - 1);
  }

  setActiveSlide(slideId) {
    if (slideId === this.state.activeSlide) return;
    this.setState({
      activeSlide: slideId,
      animationForward: this.state.activeSlide < slideId,
    });
    this.setAnimationState(ANIMATION_PHASES.PENDING);
    this.restartAutoRotate();
  }

  setAnimationState(state) {
    this.setState({ animationState: state });
  }

  restartAutoRotate() {
    window.clearInterval(this.autoRotateInterval);
    if (!AUTO_ROTAR) return;
    this.autoRotateInterval = setInterval(
      () => this.setActiveSlide((this.state.activeSlide + 1) % this.state.slidesCount),
      2000
    );
  }

  render() {
    const { slides } = this.props;
    const { activeSlide, animationForward } = this.state;

    // La lista lateral muestra 5 modelos a la vez, los más cercanos al activo
    const tamano = Math.min(5, slides.length);
    const inicio = Math.max(0, Math.min(activeSlide - 2, slides.length - tamano));
    const carsNames = slides.slice(inicio, inicio + tamano).map((s, i) => ({
      id: s.id, index: inicio + i, name: s.shortName, color: s.color,
    }));

    return h(
      "div",
      { className: "tesla-slider" },
      h(SliderNavigation, { activeSlide, setActiveSlide: this.setActiveSlide, carsNames }),
      h(Slide, {
        activeSlide: slides[activeSlide],
        animationForward,
        setAnimationState: this.setAnimationState,
        ANIMATION_PHASES,
      }),
      h("div", { className: "tesla-slider__scroll" }, h("img", { src: mouseImg, alt: "" }))
    );
  }
}

function App({ slides, inicio }) {
  return h("div", { className: "container" }, h(Header, null), h(Slider, { slides, inicio }));
}

// ========================================
// Arranque: la página principal envía los autos que se están viendo y cuál se eligió
// ========================================
let iniciado = false;

window.addEventListener("message", (e) => {
  if (e.source !== window.parent || iniciado) return;
  const datos = e.data;
  if (!datos || datos.tipo !== "init" || !Array.isArray(datos.autos) || !datos.autos.length) return;
  iniciado = true;
  const slides = crearSlides(datos.autos);
  const inicio = Math.max(0, Math.min(Number(datos.inicio) || 0, slides.length - 1));
  ReactDOM.render(h(App, { slides, inicio }), document.getElementById("root"));
});
