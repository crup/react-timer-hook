import React from 'react';

type RecipePlaygroundProps = {
  title: string;
  children: React.ReactNode;
};

export default function RecipePlayground({ title, children }: RecipePlaygroundProps) {
  return (
    <section className="recipe-playground">
      <div className="recipe-playground__header">
        <span>{title}</span>
        <span className="recipe-playground__badge">Live</span>
      </div>
      <div className="recipe-playground__body">{children}</div>
    </section>
  );
}
