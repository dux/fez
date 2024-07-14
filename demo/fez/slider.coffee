# it must have div an then div, so we can read real height and animate height change
# <ui-slider dotts="true" arrows="true" next="5000">
#   <div>
#     <div data-question="Tip">
#       <h2>...</h2>

Fez 'ui-slider', class extends FezBase
  @css = """
    .parent {
      overflow: hidden;

      .slides {
        display: flex;
        flex-direction: row;
        transition: transform 0.3s ease-in-out, height .6s ease;
        width: 100%;
        height: var(--height);
        gap: var(--gap);

        & > div {
          flex: 1;
          min-width: var(--width);
          max-width: var(--width);
        }
      }
    }

    .dotts {
      margin-top: calc(var(--gap) / 1.2);
      display: flex;
      justify-content: center;
      gap: 7px;

      span {
        min-width: 15px;
        min-height: 15px;
        border: 2px solid var(--base-color);
        border-radius: 10px;
        cursor: pointer;

        &:hover, &.active {
          border: 7px solid var(--base-color);
        }
      }
    }

    .arrow {
      position: relative;

      & > div {
        width: 25px;
        height: 25px;
        border-top: 5px solid var(--base-color);
        border-left: 5px solid var(--base-color);
        position: absolute;
        top: calc(var(--height) / 2 - 13px);
        z-index: 1;
        transition: all 0.3s ease-in-out;
        cursor: pointer;

        &:hover {
          border-color: var(--green-6);
        }

        &.left {
          left: 0;
          transform: rotate(-45deg);
          margin-left: calc(var(--gap) * -1.3);
        }

        &.right {
          right: 0;
          margin-right: calc(var(--gap) * -1.3);
          transform: rotate(135deg);
        }
      }
    }
  """

  setFrame: (num) =>
    if typeof num == 'number'
      @currentSlide = num
    else
      num = @currentSlide

    window.requestAnimationFrame =>
      slidesRoot = @$root.find('.slides')
      sliderWidth = slidesRoot.width()
      sliderNode = slidesRoot.find("& > div:nth-child(#{num+1}) > div")
      sliderHeight = sliderNode[0].getBoundingClientRect().height

      @$root.css('--width', "#{sliderWidth}px")
      @$root.css('--height', "#{sliderHeight}px")
      @$root.css('--gap', "#{@gap}px")

      offset = num * (sliderWidth + @gap)
      slidesRoot.css('transform', "translateX(-#{offset}px)")

      @$root.find(".dot-#{num}").activate()

    num

  nextSlide: () =>
    @currentSlide = if @slides[@currentSlide + 1] then @currentSlide + 1 else 0
    @setFrame()

  prevSlide: () =>
    @currentSlide = if @currentSlide > 0 then @currentSlide - 1 else @slides.length - 1
    @setFrame()

  connect: (props) =>
    @gap = parseInt(props.gap || 30)
    @slides = @$root.find('&>div').get()

    # this will allow dinamic slide height
    for slide in @slides
      @$root.append $('<div />').append(slide)

    @html """
      {{if @props.arrows}}
        <div class="arrow">
          <div class="left" onmousedown="$$.prevSlide(true)"></div>
          <div class="right" onmousedown="$$.nextSlide(true)"></div>
        </div>
      {{/if}}
      <div class="parent">
        <div class="slides">
          <slot />
        </div>
      </div>
      {{if @props.dotts}}
        <div class="dotts">
          {{each @slides as el, i}}
            <span class="dot-{{i}}" onmousedown="$$.setFrame({{i}})"></span>
          {{/each}}
        </div>
      {{/if}}
    """

    @$root.first('img').one 'load', @setFrame

    @setFrame(0)
    # sometimes does not get height
    setTimeout =>
      @setFrame(0)
    , 100

    Pubsub.sub 'window-resize', $.throttle(@setFrame, 300)

    if props.next
      props.next = setInterval @nextSlide, parseInt(props.next)
      @$root.one 'click', ()=>clearInterval(props.next)


