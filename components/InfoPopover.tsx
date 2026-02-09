"use client";

export function InfoPopover(props: {
  title: string;
  formula: string;
}) {
  return (
    <div className="popover" role="tooltip" aria-label={`${props.title} formula`}>
      <p className="formulaText">
        {props.title} = {props.formula}
      </p>
    </div>
  );
}
