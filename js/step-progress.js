/**
 * EICOOP Reusable Step Progress Component
 */
(function() {
  // Inject component styles if not already present
  if (!document.getElementById('step-progress-styles')) {
    const style = document.createElement('style');
    style.id = 'step-progress-styles';
    style.textContent = `
      .step-progress-container {
        width: 100%;
        margin-bottom: 30px;
        padding: 10px 0;
      }
      .step-progress {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        position: relative;
        width: 100%;
      }
      .step-progress-line {
        position: absolute;
        top: 20px;
        left: 0;
        height: 4px;
        background: var(--line, #dbe7ef);
        width: 100%;
        z-index: 1;
        transform: translateY(-50%);
      }
      .step-progress-line-fill {
        height: 100%;
        background: var(--green, #138a65);
        transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        width: 0%;
      }
      .step-item {
        position: relative;
        z-index: 2;
        display: flex;
        flex-direction: column;
        align-items: center;
        flex: 1;
        text-align: center;
      }
      .step-badge {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: #fff;
        border: 3px solid var(--line, #dbe7ef);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        color: var(--muted, #667788);
        font-size: 14px;
        transition: all 0.3s ease;
        box-shadow: 0 4px 10px rgba(0,0,0,0.05);
      }
      .step-item.active .step-badge {
        border-color: var(--blue, #0b72b9);
        color: var(--blue, #0b72b9);
        background: var(--sky, #eaf7ff);
        transform: scale(1.05);
        box-shadow: 0 4px 15px rgba(11, 114, 185, 0.15);
      }
      .step-item.completed .step-badge {
        border-color: var(--green, #138a65);
        color: #fff;
        background: var(--green, #138a65);
      }
      .step-content {
        margin-top: 10px;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .step-label {
        font-size: 13px;
        font-weight: 700;
        color: var(--muted, #667788);
        max-width: 140px;
        transition: all 0.3s ease;
        line-height: 1.3;
      }
      .step-item.active .step-label {
        color: var(--navy, #041f35);
      }
      .step-item.completed .step-label {
        color: var(--green, #138a65);
      }
      .step-desc {
        font-size: 11px;
        color: var(--muted, #667788);
        margin-top: 4px;
        max-width: 150px;
        line-height: 1.3;
      }
      
      @media (max-width: 768px) {
        .step-progress {
          flex-direction: column;
          align-items: flex-start;
          gap: 20px;
          padding-left: 20px;
        }
        .step-progress-line {
          left: 38px;
          top: 0;
          bottom: 0;
          width: 4px;
          height: calc(100% - 40px);
          transform: none;
          margin-top: 20px;
        }
        .step-item {
          flex-direction: row;
          align-items: flex-start;
          text-align: left;
          gap: 15px;
          flex: none;
          width: 100%;
        }
        .step-content {
          margin-top: 0;
          align-items: flex-start;
        }
        .step-label {
          max-width: none;
        }
        .step-desc {
          max-width: none;
          text-align: left;
        }
      }
    `;
    document.head.appendChild(style);
  }

  class StepProgress {
    constructor(containerId, steps, currentStep = 1) {
      this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
      this.steps = steps; // Array of { title, description }
      this.currentStep = currentStep; // 1-indexed
      this.render();
    }

    setStep(step) {
      if (step < 1 || step > this.steps.length) return;
      this.currentStep = step;
      this.render();
    }

    render() {
      if (!this.container) return;
      
      // Calculate progress line fill width / height
      let fillPercentage = 0;
      if (this.steps.length > 1) {
        fillPercentage = ((this.currentStep - 1) / (this.steps.length - 1)) * 100;
      }

      let stepsHtml = this.steps.map((step, idx) => {
        const stepNum = idx + 1;
        let stateClass = '';
        let badgeContent = stepNum;
        let ariaCurrent = '';

        if (stepNum < this.currentStep) {
          stateClass = 'completed';
          badgeContent = '✓';
        } else if (stepNum === this.currentStep) {
          stateClass = 'active';
          ariaCurrent = 'aria-current="step"';
        } else {
          stateClass = 'pending';
        }

        const descHtml = step.description ? `<span class="step-desc">${step.description}</span>` : '';

        return `
          <div class="step-item ${stateClass}" ${ariaCurrent}>
            <div class="step-badge" aria-label="Step ${stepNum} of ${this.steps.length}${stateClass === 'completed' ? ', completed' : stateClass === 'active' ? ', current' : ''}">
              ${badgeContent}
            </div>
            <div class="step-content">
              <span class="step-label">${step.title}</span>
              ${descHtml}
            </div>
          </div>
        `;
      }).join('');

      this.container.innerHTML = `
        <div class="step-progress-container" role="progressbar" aria-valuemin="1" aria-valuemax="${this.steps.length}" aria-valuenow="${this.currentStep}">
          <div class="step-progress">
            <div class="step-progress-line">
              <div class="step-progress-line-fill" style="width: ${fillPercentage}%;"></div>
            </div>
            ${stepsHtml}
          </div>
        </div>
      `;
      
      // Fix vertical layout line height dynamically on mobile
      const isMobile = window.innerWidth <= 768;
      if (isMobile) {
        const fillEl = this.container.querySelector('.step-progress-line-fill');
        if (fillEl) {
          fillEl.style.width = '100%';
          fillEl.style.height = `${fillPercentage}%`;
        }
      }
    }
  }

  window.StepProgress = StepProgress;
})();
